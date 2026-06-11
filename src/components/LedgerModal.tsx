'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './LedgerModal.module.css'
import { X, Plus, Trash2 } from 'lucide-react'

interface Transaction {
  id: string;
  type: 'sale' | 'payment';
  amount: number;
  ref_note: string;
  transaction_date: string;
}

interface LedgerModalProps {
  debtor: any;
  onClose: () => void;
  onDebtorDeleted?: (id: string) => void;
}

export default function LedgerModal({ debtor, onClose, onDebtorDeleted }: LedgerModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'sale' | 'payment'>('sale')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [refNote, setRefNote] = useState('')

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('debtor_id', debtor.id)
        .order('transaction_date', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          debtor_id: debtor.id,
          type,
          amount: parseFloat(amount),
          transaction_date: date,
          ref_note: refNote
        }])
        .select()
        .single()

      if (error) throw error
      
      setTransactions(prev => [data, ...prev].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()))
      setAmount('')
      setRefNote('')
    } catch (error) {
      console.error('Error adding transaction:', error)
      alert('Failed to add transaction.')
    }
  }

  const handleDelete = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', txId)

      if (error) throw error
      setTransactions(prev => prev.filter(t => t.id !== txId))
    } catch (error) {
      console.error('Error deleting transaction:', error)
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

      if (onDebtorDeleted) {
        onDebtorDeleted(debtor.id)
      }
    } catch (error) {
      console.error('Error deleting debtor:', error)
      alert('Could not delete debtor.')
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2>Ledger: {debtor.name}</h2>
            <button 
              className="btn" 
              style={{ border: '1px solid #fca5a5', color: '#ef4444', background: '#fef2f2', padding: '4px 12px', fontSize: '13px' }} 
              onClick={handleDeleteDebtor}
            >
              Delete Debtor
            </button>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.content}>
          <form onSubmit={handleAddTransaction} className={styles.formPanel}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Type</label>
                <select className="input-field" value={type} onChange={e => setType(e.target.value as any)}>
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

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
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
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(tx.amount)}</td>
                      <td>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(tx.id)}>
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
