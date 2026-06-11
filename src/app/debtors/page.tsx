'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import LedgerModal from '@/components/LedgerModal'
import styles from './page.module.css'
import { Plus, Search, User } from 'lucide-react'

export default function Debtors() {
  const [debtors, setDebtors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<any>(null)
  
  // New debtor form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newTerms, setNewTerms] = useState('15')

  useEffect(() => {
    fetchDebtors()
  }, [])

  const fetchDebtors = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('debtors')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (error) throw error
      setDebtors(data || [])
    } catch (error) {
      console.error('Error fetching debtors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDebtor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('debtors')
        .insert([{
          user_id: user.id,
          name: newName,
          phone: newPhone,
          default_terms: parseInt(newTerms) || 15
        }])
        .select()
        .single()

      if (error) throw error
      
      setDebtors(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setIsAdding(false)
      setNewName('')
      setNewPhone('')
      setNewTerms('15')
    } catch (error) {
      console.error('Error adding debtor:', error)
      alert('Could not add debtor.')
    }
  }

  const filteredDebtors = debtors.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search))

  if (loading) {
    return (
      <div className={styles.page}>
        <Navigation />
        <main className={styles.main}>Loading...</main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Navigation />
      
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1>Debtors Ledger</h1>
            <p>Manage your customers and view individual transactions.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={18} /> Add Debtor
          </button>
        </div>

        <div className={styles.searchBar}>
          <Search size={20} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={`${styles.debtorsList} glass-panel`}>
          {filteredDebtors.length === 0 ? (
            <div className={styles.emptyState}>
              No debtors found. Click "Add Debtor" to create one.
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Terms</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebtors.map(debtor => (
                  <tr key={debtor.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}><User size={16} /></div>
                        {debtor.name}
                      </div>
                    </td>
                    <td>{debtor.phone}</td>
                    <td><span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{debtor.default_terms || 15} days</span></td>
                    <td>
                      <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => setSelectedDebtor(debtor)}>
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))}
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
              <div className={styles.modalActions}>
                <button type="button" className="btn" onClick={() => setIsAdding(false)}>Cancel</button>
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
