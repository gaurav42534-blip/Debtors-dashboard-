'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Debtor, Transaction, OverdueDebtor } from '@/lib/types'
import Navigation from '@/components/Navigation'
import ReceiptGenerator from '@/components/ReceiptGenerator'
import TrendChart from '@/components/TrendChart'
import styles from './page.module.css'
import { AlertCircle, IndianRupee, TrendingUp, Clock, CalendarClock, CheckCircle2 } from 'lucide-react'

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

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: debtors, error: dError } = await supabase
        .from('debtors')
        .select(`*, transactions(*)`)
        .eq('user_id', user.id)

      if (dError) throw dError

      let globalTotalDue = 0
      let globalTotalOverdue = 0
      let overdue30 = 0
      let overdue60plus = 0
      let overdueList: OverdueDebtor[] = []

      const now = new Date()
      now.setHours(0, 0, 0, 0)

      debtors?.forEach((debtor: Debtor & { transactions: Transaction[] }) => {
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

      // Build trend data from the last 6 months
      const monthlyData = buildTrendData(debtors as (Debtor & { transactions: Transaction[] })[] || [])
      
      setStats({ totalDue: globalTotalDue, totalOverdue: globalTotalOverdue, overdue30, overdue60plus: overdue60plus })
      setOverdueDebtors(overdueList)
      setTrendData(monthlyData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
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
                <div className={`${styles.skeletonIcon} skeleton`}></div>
                <div>
                  <div className={`${styles.skeletonText} skeleton`} style={{ width: '120px', height: '14px' }}></div>
                  <div className={`${styles.skeletonText} skeleton`} style={{ width: '160px', height: '28px', marginTop: '8px' }}></div>
                </div>
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
      
      <main className={styles.main}>
        <div className={styles.header}>
          <h1>Quick Actions Dashboard</h1>
          <p>Here is your current receivables position.</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} glass-panel`}>
            <div className={styles.statIcon} style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <TrendingUp size={24} />
            </div>
            <div className={styles.statInfo}>
              <p>Total Outstanding</p>
              <h2>{formatCurrency(stats.totalDue)}</h2>
            </div>
          </div>

          <div className={`${styles.statCard} glass-panel`}>
            <div className={styles.statIcon} style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
              <IndianRupee size={24} />
            </div>
            <div className={styles.statInfo}>
              <p>Total Overdue</p>
              <h2 className={styles.dangerText}>{formatCurrency(stats.totalOverdue)}</h2>
            </div>
          </div>

          <div className={`${styles.statCard} glass-panel`}>
            <div className={styles.statIcon} style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <Clock size={24} />
            </div>
            <div className={styles.statInfo}>
              <p>30-Day Overdue</p>
              <h2 style={{ color: 'var(--warning)' }}>{formatCurrency(stats.overdue30)}</h2>
            </div>
          </div>

          <div className={`${styles.statCard} glass-panel`}>
            <div className={styles.statIcon} style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
              <CalendarClock size={24} />
            </div>
            <div className={styles.statInfo}>
              <p>60+ Day Overdue</p>
              <h2 className={styles.dangerText}>{formatCurrency(stats.overdue60plus)}</h2>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className={`${styles.chartSection} glass-panel`}>
          <TrendChart data={trendData} title="Outstanding Receivables — Last 6 Months" />
        </div>

        {/* Attention Needed */}
        <div className={`${styles.attentionSection} glass-panel`}>
          <div className={styles.sectionHeader}>
            <AlertCircle color="var(--danger)" />
            <h2>Attention Needed</h2>
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
                        <button className="btn btn-primary" onClick={() => setReceiptDebtor(debtor)}>
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
