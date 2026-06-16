'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaction, DebtorWithTransactions } from '@/lib/types'
import { useToast } from '@/components/ToastProvider'
import styles from './LedgerModal.module.css'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'

interface LedgerModalProps {
  debtor: DebtorWithTransactions
  onClose: () => void
  onDebtorDeleted?: (id: string) => void
}

export default function LedgerModal({ debtor, onClose, onDebtorDeleted }: LedgerModalProps) {
  const toast = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  // Form State
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'sale' | 'payment'>('sale')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [refNote, setRefNote] = useState('')

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    fetchTransactions()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [debtor.id])

  const fetchTransactions = async () => {
    try {
      const cacheKey = `tx_cache_${debtor.id}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        setTransactions(JSON.parse(cached))
        setLoading(false)
      }

      if (!navigator.onLine) return

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('debtor_id', debtor.id)
        .order('transaction_date', { ascending: false })

      if (error) throw error

      localStorage.setItem(cacheKey, JSON.stringify(data))
      setTransactions((data as Transaction[]) || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getBalance = () => {
    let sales = 0
    let payments = 0
    transactions.forEach(tx => {
      if (tx.type === 'sale') sales += Number(tx.amount)
      if (tx.type === 'payment') payments += Number(tx.amount)
    })
    return sales - payments
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isOffline) {
      toast.error('You are offline. Cannot add new transaction.')
      return
    }

    const newAmount = parseFloat(amount)
    const currentBalance = getBalance()

    // Warn if sale would exceed credit limit
    if (type === 'sale' && debtor.limit_amount > 0) {
      const projectedBalance = currentBalance + newAmount
      if (projectedBalance > debtor.limit_amount) {
        if (!confirm(`This sale would bring the balance to ${formatCurrency(projectedBalance)}, exceeding the credit limit of ${formatCurrency(debtor.limit_amount)}. Proceed anyway?`)) {
          return
        }
      }
    }

    const optimisticTx: Transaction = {
      id: 'temp-' + Date.now(),
      debtor_id: debtor.id,
      type,
      amount: newAmount,
      transaction_date: date,
      ref_note: refNote,
      created_at: new Date().toISOString(),
    }

    // Optimistic update
    setTransactions(prev => [optimisticTx, ...prev].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()))
    setAmount('')
    setRefNote('')

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          debtor_id: debtor.id,
          type: optimisticTx.type,
          amount: optimisticTx.amount,
          transaction_date: optimisticTx.transaction_date,
          ref_note: optimisticTx.ref_note
        }])
        .select()
        .single()

      if (error) throw error

      // Replace optimistic entry
      setTransactions(prev => prev.map(t => t.id === optimisticTx.id ? (data as Transaction) : t))
      toast.success(`${type === 'sale' ? 'Sale' : 'Payment'} of ${formatCurrency(newAmount)} recorded!`)
    } catch (error) {
      console.error('Error adding transaction:', error)
      // Rollback
      setTransactions(prev => prev.filter(t => t.id !== optimisticTx.id))
      toast.error('Failed to add transaction. Please try again.')
    }
  }

  const handleDelete = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    const deletedTx = transactions.find(t => t.id === txId)

    // Optimistic delete
    setTransactions(prev => prev.filter(t => t.id !== txId))

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)

      if (error) throw error
      toast.success('Transaction deleted.')
    } catch (error) {
      console.error('Error deleting transaction:', error)
      // Rollback
      if (deletedTx) {
        setTransactions(prev => [...prev, deletedTx].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()))
      }
      toast.error('Failed to delete transaction.')
    }
  }

  const handleDeleteDebtor = async () => {
    if (!confirm(`Are you sure you want to completely delete ${debtor.name} and all their transactions? This cannot be undone.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('debtors')
        .delete()
        .eq('id', debtor.id)

      if (error) throw error

      toast.success(`${debtor.name} deleted.`)
      if (onDebtorDeleted) {
        onDebtorDeleted(debtor.id)
      }
    } catch (error) {
      console.error('Error deleting debtor:', error)
      toast.error('Could not delete debtor.')
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  const balance = getBalance()
  const overLimit = debtor.limit_amount > 0 && balance > debtor.limit_amount

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2>Ledger: {debtor.name}</h2>
            {isOffline && (
              <span style={{ fontSize: '12px', background: 'var(--warning-light)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '4px' }}>
                Offline Mode
              </span>
            )}
            <button
              className="btn"
              style={{ border: '1px solid #fca5a5', color: 'var(--danger)', background: 'var(--danger-light)', padding: '4px 12px', fontSize: '13px' }}
              onClick={handleDeleteDebtor}
              disabled={isOffline}
            >
              Delete Debtor
            </button>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {/* Balance & Credit Limit Bar */}
        <div className={styles.balanceBar}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Outstanding</span>
            <span className={`${styles.balanceValue} ${balance > 0 ? styles.dangerText : styles.successText}`}>{formatCurrency(balance)}</span>
          </div>
          {debtor.limit_amount > 0 && (
            <div className={styles.balanceItem}>
              <span className={styles.balanceLabel}>Credit Limit</span>
              <span className={styles.balanceValue}>
                {formatCurrency(debtor.limit_amount)}
                {overLimit && <AlertTriangle size={16} className={styles.limitWarning} />}
              </span>
            </div>
          )}
        </div>

        <div className={styles.content}>
          <form onSubmit={handleAddTransaction} className={styles.formPanel}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Type</label>
                <select className="input-field" value={type} onChange={e => setType(e.target.value as 'sale' | 'payment')}>
                  <option value="sale">Credit Sale</option>
                  <option value="payment">Payment Received</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Date</label>
                <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Amount</label>
                <input type="number" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} required min="1" />
              </div>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>Reference Note</label>
                <input type="text" className="input-field" value={refNote} onChange={e => setRefNote(e.target.value)} placeholder="e.g. Bill #1234 or UPI" />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={isOffline}>
              <Plus size={16} /> Add Transaction
            </button>
          </form>

          <div className={styles.historyPanel}>
            <h3>Transaction History</h3>
            {loading ? <p>Loading...</p> : (
              transactions.length === 0 ? <p className={styles.empty}>No transactions recorded.</p> :
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Note</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.transaction_date).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span className={`${styles.badge} ${tx.type === 'sale' ? styles.badgeDanger : styles.badgeSuccess}`}>
                            {tx.type === 'sale' ? 'Sale' : 'Payment'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{tx.ref_note || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(Number(tx.amount))}</td>
                        <td>
                          <button className={styles.deleteBtn} onClick={() => handleDelete(tx.id)} disabled={isOffline}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
