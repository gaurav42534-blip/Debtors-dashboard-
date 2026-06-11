'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Debtor, Transaction, DebtorWithTransactions } from '@/lib/types'
import { exportToCSV } from '@/lib/exportData'
import { useToast } from '@/components/ToastProvider'
import Navigation from '@/components/Navigation'
import LedgerModal from '@/components/LedgerModal'
import styles from './page.module.css'
import { Plus, Search, User, Download, AlertTriangle } from 'lucide-react'

export default function Debtors() {
  const toast = useToast()
  const [debtors, setDebtors] = useState<DebtorWithTransactions[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name_asc')
  const [isAdding, setIsAdding] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<DebtorWithTransactions | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  
  // New debtor form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newTerms, setNewTerms] = useState('15')
  const [newLimit, setNewLimit] = useState('0')

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    setIsOffline(!navigator.onLine)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    fetchDebtors()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const fetchDebtors = async () => {
    try {
      // 1. Try local cache first for instant/offline load
      const cached = localStorage.getItem('debtors_cache')
      if (cached) {
        setDebtors(JSON.parse(cached))
        setLoading(false)
      }

      // 2. Fetch fresh from network
      if (!navigator.onLine) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('debtors')
        .select('*, transactions(*)')
        .eq('user_id', user.id)
        .order('name')

      if (error) throw error

      // 3. Update cache & re-process
      localStorage.setItem('debtors_cache', JSON.stringify(data))
      setDebtors((data as DebtorWithTransactions[]) || [])
    } catch (error) {
      console.error('Error fetching debtors:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcBalance = (debtor: DebtorWithTransactions) => {
    let sales = 0
    let payments = 0
    debtor.transactions?.forEach((tx: Transaction) => {
      if (tx.type === 'sale') sales += Number(tx.amount)
      if (tx.type === 'payment') payments += Number(tx.amount)
    })
    return sales - payments
  }

  const handleAddDebtor = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isOffline) {
      toast.error('You are offline. Cannot add new debtor.')
      return
    }

    const optimisticDebtor: DebtorWithTransactions = {
      id: 'temp-' + Date.now(),
      user_id: '',
      name: newName,
      phone: newPhone,
      default_terms: parseInt(newTerms) || 15,
      limit_amount: parseFloat(newLimit) || 0,
      created_at: new Date().toISOString(),
      transactions: [],
    }

    // Optimistic: add to list immediately
    setDebtors(prev => [...prev, optimisticDebtor].sort((a, b) => a.name.localeCompare(b.name)))
    setIsAdding(false)
    setNewName('')
    setNewPhone('')
    setNewTerms('15')
    setNewLimit('0')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('debtors')
        .insert([{
          user_id: user.id,
          name: optimisticDebtor.name,
          phone: optimisticDebtor.phone,
          default_terms: optimisticDebtor.default_terms,
          limit_amount: optimisticDebtor.limit_amount,
        }])
        .select('*, transactions(*)')
        .single()

      if (error) throw error
      
      // Replace optimistic entry with real data
      setDebtors(prev => prev.map(d => d.id === optimisticDebtor.id ? (data as DebtorWithTransactions) : d))
      toast.success(`${data.name} added successfully!`)
    } catch (error) {
      console.error('Error adding debtor:', error)
      // Rollback optimistic update
      setDebtors(prev => prev.filter(d => d.id !== optimisticDebtor.id))
      toast.error('Could not add debtor. Please try again.')
    }
  }

  const handleExport = () => {
    const exportData = filteredDebtors.map(d => ({
      Name: d.name,
      Phone: d.phone,
      'Terms (Days)': d.default_terms,
      'Credit Limit': d.limit_amount || 0,
      'Outstanding Balance': calcBalance(d),
    }))
    exportToCSV(exportData, `Debtors_${new Date().toISOString().split('T')[0]}`)
    toast.success('Exported to CSV!')
  }

  const filteredDebtors = debtors
    .filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search))
    .sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
      if (sortBy === 'balance_desc') return calcBalance(b) - calcBalance(a)
      if (sortBy === 'balance_asc') return calcBalance(a) - calcBalance(b)
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return 0
    })

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Navigation />
        <main className={styles.main}>
          <div className={styles.header}>
            <div>
              <div className={`${styles.skeletonText} skeleton`} style={{ width: '200px', height: '28px' }}></div>
              <div className={`${styles.skeletonText} skeleton`} style={{ width: '320px', height: '16px', marginTop: '8px' }}></div>
            </div>
          </div>
          <div className={`${styles.skeletonSearch} skeleton`}></div>
          <div className={`glass-panel`} style={{ padding: '16px 24px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={styles.skeletonRow}>
                <div className={`${styles.skeletonCircle} skeleton`}></div>
                <div className={`${styles.skeletonText} skeleton`} style={{ width: '140px', height: '16px' }}></div>
                <div className={`${styles.skeletonText} skeleton`} style={{ width: '100px', height: '16px', marginLeft: 'auto' }}></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Navigation />
      
      {isOffline && (
        <div className={styles.offlineBanner}>
          <AlertTriangle size={16} />
          You are currently offline. Viewing cached data. Changes disabled.
        </div>
      )}
      
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1>Debtors Ledger</h1>
            <p>Manage your customers and view individual transactions.</p>
          </div>
          <div className={styles.headerActions}>
            <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={handleExport} disabled={isOffline}>
              <Download size={18} /> Export
            </button>
            <button className="btn btn-primary" onClick={() => setIsAdding(true)} disabled={isOffline}>
              <Plus size={18} /> Add Debtor
            </button>
          </div>
        </div>

        <div className={styles.controlsRow}>
          <div className={styles.searchBar}>
            <Search size={20} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className={`input-field ${styles.sortSelect}`} 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="balance_desc">Highest Balance</option>
            <option value="balance_asc">Lowest Balance</option>
            <option value="newest">Recently Added</option>
          </select>
        </div>

        <div className={`${styles.debtorsList} glass-panel`}>
          {filteredDebtors.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <User size={36} />
              </div>
              <h3>No debtors found</h3>
              <p>Click &quot;Add Debtor&quot; to create your first customer.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Terms</th>
                  <th className={styles.textRight}>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebtors.map(debtor => {
                  const balance = calcBalance(debtor)
                  const overLimit = debtor.limit_amount > 0 && balance > debtor.limit_amount
                  return (
                    <tr key={debtor.id}>
                      <td>
                        <div className={styles.nameCell}>
                          <div className={styles.avatar}><User size={16} /></div>
                          <span>{debtor.name}</span>
                          {overLimit && (
                            <span className={styles.creditWarning} title={`Exceeds credit limit of ${formatCurrency(debtor.limit_amount)}`}>
                              <AlertTriangle size={14} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{debtor.phone}</td>
                      <td><span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{debtor.default_terms || 15} days</span></td>
                      <td className={`${styles.textRight} ${balance > 0 ? styles.dangerText : styles.successText}`}>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(balance)}</span>
                      </td>
                      <td>
                        <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => setSelectedDebtor(debtor)}>
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Add Modal */}
      {isAdding && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Add New Debtor</h2>
            <form onSubmit={handleAddDebtor}>
              <div className="form-group">
                <label>Full Name or Shop Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Phone Number (for WhatsApp)</label>
                <input 
                  type="tel" 
                  className="input-field" 
                  required 
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Due Period Allowance (Days)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  required 
                  min="0"
                  value={newTerms}
                  onChange={e => setNewTerms(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Credit Limit (₹0 = unlimited)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  min="0"
                  value={newLimit}
                  onChange={e => setNewLimit(e.target.value)}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => setIsAdding(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Debtor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDebtor && (
        <LedgerModal 
          debtor={selectedDebtor} 
          onClose={() => setSelectedDebtor(null)} 
          onDebtorDeleted={(id) => {
            setDebtors(prev => prev.filter(d => d.id !== id));
            setSelectedDebtor(null);
          }}
        />
      )}
    </div>
  )
}
