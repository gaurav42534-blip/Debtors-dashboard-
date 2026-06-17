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

const AVATAR_PALETTES = [
  { bg: '#E8F4FD', color: '#1565C0' },
  { bg: '#F3E5F5', color: '#7B1FA2' },
  { bg: '#E8F5E9', color: '#2E7D32' },
  { bg: '#FFF3E0', color: '#E65100' },
  { bg: '#FCE4EC', color: '#C62828' },
  { bg: '#E0F2F1', color: '#00695C' },
]
const getAvatarStyle = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length]
}

export default function LedgerModal({ debtor, onClose, onDebtorDeleted }: LedgerModalProps) {
  const toast = useToast()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

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
      if (cached) { setTransactions(JSON.parse(cached)); setLoading(false) }
      if (!navigator.onLine) return
      const { data, error } = await supabase
        .from('transactions').select('*').eq('debtor_id', debtor.id)
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
    let sales = 0, payments = 0
    transactions.forEach(tx => {
      if (tx.type === 'sale') sales += Number(tx.amount)
      if (tx.type === 'payment') payments += Number(tx.amount)
    })
    return sales - payments
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isOffline) { toast.error('You are offline. Cannot add new transaction.'); return }
    const newAmount = parseFloat(amount)
    const currentBalance = getBalance()
    if (type === 'sale' && debtor.limit_amount > 0) {
      const projectedBalance = currentBalance + newAmount
      if (projectedBalance > debtor.limit_amount) {
        if (!confirm(`This sale would bring the balance to ${formatCurrency(projectedBalance)}, exceeding the credit limit of ${formatCurrency(debtor.limit_amount)}. Proceed anyway?`)) return
      }
    }
    const optimisticTx: Transaction = {
      id: 'temp-' + Date.now(), debtor_id: debtor.id, type,
      amount: newAmount, transaction_date: date, ref_note: refNote, created_at: new Date().toISOString(),
    }
    setTransactions(prev => [optimisticTx, ...prev].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()))
    setAmount(''); setRefNote('')
    try {
      const { data, error } = await supabase.from('transactions')
        .insert([{ debtor_id: debtor.id, type, amount: newAmount, transaction_date: date, ref_note: refNote }])
        .select().single()
      if (error) throw error
      setTransactions(prev => prev.map(t => t.id === optimisticTx.id ? (data as Transaction) : t))
      toast.success(`${type === 'sale' ? 'Sale' : 'Payment'} of ${formatCurrency(newAmount)} recorded!`)
    } catch (error) {
      console.error('Error adding transaction:', error)
      setTransactions(prev => prev.filter(t => t.id !== optimisticTx.id))
      toast.error('Failed to add transaction. Please try again.')
    }
  }

  const handleDelete = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    const deletedTx = transactions.find(t => t.id === txId)
    setTransactions(prev => prev.filter(t => t.id !== txId))
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txId)
      if (error) throw error
      toast.success('Transaction deleted.')
    } catch (error) {
      console.error('Error deleting transaction:', error)
      if (deletedTx) setTransactions(prev => [...prev, deletedTx].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()))
      toast.error('Failed to delete transaction.')
    }
  }

  const handleDeleteDebtor = async () => {
    if (!confirm(`Are you sure you want to completely delete ${debtor.name} and all their transactions? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('debtors').delete().eq('id', debtor.id)
      if (error) throw error
      toast.success(`${debtor.name} deleted.`)
      if (onDebtorDeleted) onDebtorDeleted(debtor.id)
    } catch (error) {
      console.error('Error deleting debtor:', error)
      toast.error('Could not delete debtor.')
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)

  const balance = getBalance()
  const overLimit = debtor.limit_amount > 0 && balance > debtor.limit_amount

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Navy header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.debtorAvatar} style={{ background: getAvatarStyle(debtor.name).bg, color: getAvatarStyle(debtor.name).color, boxShadow: 'none' }}>{debtor.name.charAt(0).toUpperCase()}</div>
            <div className={styles.headerInfo}>
              <h2>{debtor.name}</h2>
            </div>
            {isOffline && <span className={styles.offlinePill}>Offline</span>}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.deleteDebtorBtn} onClick={handleDeleteDebtor} disabled={isOffline}>
              Delete
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true" /></button>
          </div>
        </div>

        {/* Balance bar */}
        <div className={styles.balanceBar}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceLabel}>Outstanding</span>
            <span className={`${styles.balanceValue} ${balance > 0 ? styles.dangerText : styles.successText}`}>
              {formatCurrency(balance)}
            </span>
          </div>
          {debtor.limit_amount > 0 && (
            <div className={styles.balanceItem}>
              <span className={styles.balanceLabel}>Credit Limit</span>
              <span className={styles.balanceValue}>
                {formatCurrency(debtor.limit_amount)}
                {overLimit && <AlertTriangle size={15} className={styles.limitWarning} />}
              </span>
            </div>
          )}
        </div>

        <div className={styles.content}>

          {/* Add transaction form */}
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
                <label>Amount (₹)</label>
                <input type="number" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} required min="1" placeholder="0" />
              </div>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>Reference Note</label>
                <input type="text" className="input-field" value={refNote} onChange={e => setRefNote(e.target.value)} placeholder="e.g. Bill #1234 or UPI" />
              </div>
            </div>
            <button type="submit" className={`btn btn-primary ${styles.addBtn}`} disabled={isOffline}>
              <Plus size={15} aria-hidden="true" /> Add Transaction
            </button>
          </form>

          {/* Transaction history */}
          <div className={styles.historyPanel}>
            <h3>Transaction History</h3>
            {loading ? (
              <p className={styles.empty}>Loading…</p>
            ) : transactions.length === 0 ? (
              <p className={styles.empty}>No transactions recorded yet.</p>
            ) : (
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
                      <td style={{ color: 'var(--text-secondary)' }}>{tx.ref_note || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(Number(tx.amount))}</td>
                      <td>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(tx.id)} disabled={isOffline} aria-label="Delete transaction">
                          <Trash2 size={14} aria-hidden="true" />
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
