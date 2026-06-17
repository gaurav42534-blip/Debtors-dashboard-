'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Debtor, Transaction, OverdueDebtor } from '@/lib/types'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import styles from './page.module.css'

const ReceiptGenerator = dynamic(() => import('@/components/ReceiptGenerator'))
const TrendChart = dynamic(() => import('@/components/TrendChart'))
import { AlertCircle, CheckCircle2, Wallet, CircleAlert, CalendarClock, CalendarX } from 'lucide-react'

interface AgingStats {
  totalDue: number
  totalOverdue: number
  overdue30: number
  overdue60plus: number
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AgingStats>({ totalDue: 0, totalOverdue: 0, overdue30: 0, overdue60plus: 0 })
  const [overdueDebtors, setOverdueDebtors] = useState<OverdueDebtor[]>([])
  const [receiptDebtor, setReceiptDebtor] = useState<OverdueDebtor | null>(null)
  const [trendData, setTrendData] = useState<{ label: string; value: number }[]>([])
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    setIsOffline(!navigator.onLine)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    fetchDashboardData()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      // 1. Try local cache first for instant/offline load
      const cached = localStorage.getItem('debtors_cache')
      if (cached) {
        processDashboardData(JSON.parse(cached))
        setLoading(false)
      }

      // 2. Fetch fresh from network
      if (!navigator.onLine) return

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) return
      const user = authData.user

      const { data: debtors, error: dError } = await supabase
        .from('debtors')
        .select(`*, transactions(*)`)
        .eq('user_id', user.id)

      if (dError) throw dError

      // 3. Update cache & re-process
      localStorage.setItem('debtors_cache', JSON.stringify(debtors))
      processDashboardData(debtors as (Debtor & { transactions: Transaction[] })[])
    } catch (error) {
      if (error instanceof TypeError && (error as TypeError).message === 'Failed to fetch') return
      console.warn('Dashboard fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const processDashboardData = (debtors: (Debtor & { transactions: Transaction[] })[]) => {
    let globalTotalDue = 0
    let globalTotalOverdue = 0
    let overdue30 = 0
    let overdue60plus = 0
    let overdueList: OverdueDebtor[] = []

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    debtors?.forEach((debtor) => {
      let totalSales = 0
      let totalPayments = 0
      
      debtor.transactions?.forEach((tx: Transaction) => {
        if (tx.type === 'sale') totalSales += Number(tx.amount)
        if (tx.type === 'payment') totalPayments += Number(tx.amount)
      })

      const totalDue = totalSales - totalPayments
      let overdue = 0
      let od30 = 0
      let od60 = 0

      if (totalDue > 0) {
        globalTotalDue += totalDue
        let remainingPayment = totalPayments
        
        const sales = debtor.transactions
          ?.filter((tx: Transaction) => tx.type === 'sale')
          .sort((a: Transaction, b: Transaction) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()) || []
          
        for (const sale of sales) {
          if (remainingPayment >= Number(sale.amount)) {
            remainingPayment -= Number(sale.amount)
          } else {
            const unpaidPortion = Number(sale.amount) - remainingPayment
            remainingPayment = 0
            
            const saleDate = new Date(sale.transaction_date)
            const dueDate = new Date(saleDate)
            dueDate.setDate(dueDate.getDate() + debtor.default_terms)
            
            if (now > dueDate) {
              overdue += unpaidPortion
              const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
              if (daysOverdue > 60) {
                od60 += unpaidPortion
              } else if (daysOverdue > 30) {
                od30 += unpaidPortion
              }
            }
          }
        }

        if (overdue > 0) {
          globalTotalOverdue += overdue
          overdue30 += od30
          overdue60plus += od60
          overdueList.push({
            ...debtor,
            overdueAmount: overdue
          })
        }
      }
    })

    overdueList.sort((a, b) => b.overdueAmount - a.overdueAmount)

    const monthlyData = buildTrendData(debtors)
    
    setStats({ totalDue: globalTotalDue, totalOverdue: globalTotalOverdue, overdue30, overdue60plus: overdue60plus })
    setOverdueDebtors(overdueList)
    setTrendData(monthlyData)
  }


  const buildTrendData = (debtors: (Debtor & { transactions: Transaction[] })[]) => {
    const now = new Date()
    const months: { label: string; value: number }[] = []

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const label = monthDate.toLocaleDateString('en-IN', { month: 'short' })

      let outstanding = 0
      debtors.forEach(debtor => {
        let sales = 0
        let payments = 0
        debtor.transactions?.forEach((tx: Transaction) => {
          const txDate = new Date(tx.transaction_date)
          if (txDate <= endOfMonth) {
            if (tx.type === 'sale') sales += Number(tx.amount)
            if (tx.type === 'payment') payments += Number(tx.amount)
          }
        })
        outstanding += Math.max(0, sales - payments)
      })

      months.push({ label, value: outstanding })
    }

    return months
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className={styles.page}>
        <Navigation />
        <main className={styles.main}>
          <div className={styles.header}>
            <div className={`${styles.skeletonText} skeleton`} style={{ width: '280px', height: '28px' }}></div>
            <div className={`${styles.skeletonText} skeleton`} style={{ width: '320px', height: '16px', marginTop: '8px' }}></div>
          </div>
          <div className={styles.statsGrid}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`${styles.statCard} glass-panel`}>
                <div className={`${styles.skeletonText} skeleton`} style={{ width: '100px', height: '12px' }}></div>
                <div className={`${styles.skeletonText} skeleton`} style={{ width: '150px', height: '28px', marginTop: '12px' }}></div>
              </div>
            ))}
          </div>
          <div className={`${styles.skeletonChart} glass-panel skeleton`}></div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Navigation />
      
      {isOffline && (
        <div className={styles.offlineBanner}>
          <AlertCircle size={16} />
          You are currently offline. Viewing cached data.
        </div>
      )}
      
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <p className={styles.greeting}>{getGreeting()}</p>
            <h1>Receivables Overview</h1>
          </div>
          <span className={styles.headerDate}>{todayLabel}</span>
        </div>

        {/* Hero stat + supporting stats */}
        <div className={styles.statsGrid}>
          {/* Hero: Total Outstanding */}
          <div className={`${styles.statCard} ${styles.statCardHero} glass-panel`}>
            <p className={styles.statLabel}><Wallet size={14} aria-hidden="true" />Total Outstanding</p>
            <h2 className={styles.statValueHero}>{formatCurrency(stats.totalDue)}</h2>
            <p className={styles.statSubtext}>across all debtors</p>
          </div>

          {/* Supporting 3 */}
          <div className={styles.statsSub}>
            <div className={`${styles.statCard} ${styles.statCardRed} glass-panel`}>
              <p className={styles.statLabel}><CircleAlert size={14} aria-hidden="true" />Total Overdue</p>
              <h2 className={`${styles.statValue} ${styles.dangerText}`}>{formatCurrency(stats.totalOverdue)}</h2>
            </div>

            <div className={`${styles.statCard} ${styles.statCardAmber} glass-panel`}>
              <p className={styles.statLabel}><CalendarClock size={14} aria-hidden="true" />30-Day Overdue</p>
              <h2 className={`${styles.statValue} ${styles.warningText}`}>{formatCurrency(stats.overdue30)}</h2>
            </div>

            <div className={`${styles.statCard} ${styles.statCardRed} glass-panel`}>
              <p className={styles.statLabel}><CalendarX size={14} aria-hidden="true" />60+ Day Overdue</p>
              <h2 className={`${styles.statValue} ${styles.dangerText}`}>{formatCurrency(stats.overdue60plus)}</h2>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className={`${styles.chartSection} glass-panel`}>
          <TrendChart data={trendData} title="Outstanding Receivables — Last 6 Months" />
        </div>

        {/* Payment Watch */}
        <div className={`${styles.attentionSection} glass-panel`}>
          <div className={styles.sectionHeader}>
            <AlertCircle size={18} color="var(--danger)" aria-hidden="true" />
            <h2>Payment Watch</h2>
            {overdueDebtors.length > 0 && (
              <span className={styles.countBadge}>{overdueDebtors.length}</span>
            )}
          </div>
          
          {overdueDebtors.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <CheckCircle2 size={40} />
              </div>
              <h3>All clear!</h3>
              <p>Great job! You have no overdue payments right now.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Debtor Name</th>
                    <th>Phone</th>
                    <th className={styles.textRight}>Overdue Amount</th>
                    <th className={styles.textRight}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueDebtors.map(debtor => (
                    <tr key={debtor.id}>
                      <td className={styles.strong}>{debtor.name}</td>
                      <td>{debtor.phone}</td>
                      <td className={`${styles.textRight} ${styles.dangerText} ${styles.strong}`}>
                        {formatCurrency(debtor.overdueAmount)}
                      </td>
                      <td className={styles.textRight}>
                        <button className="btn btn-primary btn-sm" onClick={() => setReceiptDebtor(debtor)}>
                          Send Reminder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {receiptDebtor && (
        <ReceiptGenerator debtor={receiptDebtor} onClose={() => setReceiptDebtor(null)} />
      )}
    </div>
  )
}
