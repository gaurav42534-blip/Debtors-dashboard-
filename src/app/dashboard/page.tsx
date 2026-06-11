'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import ReceiptGenerator from '@/components/ReceiptGenerator'
import styles from './page.module.css'
import { AlertCircle, IndianRupee, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalDue: 0, totalOverdue: 0 })
  const [overdueDebtors, setOverdueDebtors] = useState<any[]>([])
  const [receiptDebtor, setReceiptDebtor] = useState<any>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all debtors and their transactions for the user
      const { data: debtors, error: dError } = await supabase
        .from('debtors')
        .select(`*, transactions(*)`)
        .eq('user_id', user.id)

      if (dError) throw dError

      let globalTotalDue = 0
      let globalTotalOverdue = 0
      let overdueList: any[] = []

      const now = new Date()
      now.setHours(0, 0, 0, 0)

      debtors?.forEach(debtor => {
        let totalSales = 0
        let totalPayments = 0
        
        debtor.transactions?.forEach((tx: any) => {
          if (tx.type === 'sale') totalSales += Number(tx.amount)
          if (tx.type === 'payment') totalPayments += Number(tx.amount)
        })

        const totalDue = totalSales - totalPayments
        let overdue = 0

        if (totalDue > 0) {
          globalTotalDue += totalDue
          let remainingPayment = totalPayments
          
          const sales = debtor.transactions
            ?.filter((tx: any) => tx.type === 'sale')
            .sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()) || []
            
          for (let sale of sales) {
            if (remainingPayment >= Number(sale.amount)) {
              remainingPayment -= Number(sale.amount)
            } else {
              let unpaidPortion = Number(sale.amount) - remainingPayment
              remainingPayment = 0
              
              let saleDate = new Date(sale.transaction_date)
              let dueDate = new Date(saleDate)
              dueDate.setDate(dueDate.getDate() + debtor.default_terms)
              
              if (now > dueDate) {
                overdue += unpaidPortion
              }
            }
          }

          if (overdue > 0) {
            globalTotalOverdue += overdue
            overdueList.push({
              ...debtor,
              overdueAmount: overdue
            })
          }
        }
      })

      overdueList.sort((a, b) => b.overdueAmount - a.overdueAmount)
      
      setStats({ totalDue: globalTotalDue, totalOverdue: globalTotalOverdue })
      setOverdueDebtors(overdueList)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Loading your dashboard...</p>
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
            <div className={styles.statIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <TrendingUp size={24} />
            </div>
            <div className={styles.statInfo}>
              <p>Total Outstanding</p>
              <h2>{formatCurrency(stats.totalDue)}</h2>
            </div>
          </div>

          <div className={`${styles.statCard} glass-panel`}>
            <div className={styles.statIcon} style={{ background: '#fef2f2', color: '#dc2626' }}>
              <IndianRupee size={24} />
            </div>
            <div className={styles.statInfo}>
              <p>Total Overdue</p>
              <h2 className={styles.dangerText}>{formatCurrency(stats.totalOverdue)}</h2>
            </div>
          </div>
        </div>

        <div className={`${styles.attentionSection} glass-panel`}>
          <div className={styles.sectionHeader}>
            <AlertCircle color="#ef4444" />
            <h2>Attention Needed</h2>
          </div>
          
          {overdueDebtors.length === 0 ? (
            <div className={styles.emptyState}>
              Great job! You have no overdue payments right now.
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
