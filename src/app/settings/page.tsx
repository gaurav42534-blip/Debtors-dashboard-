'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Save, Store, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getShopName, saveShopName } from '@/lib/shopSettings'
import Navigation from '@/components/Navigation'
import styles from './page.module.css'

export default function SettingsPage() {
  const router = useRouter()
  const [shopName, setShopName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        getShopName().then(name => {
          setShopName(name)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })
  }, [])

  const handleSave = async () => {
    if (!shopName.trim()) return
    setSaving(true)
    setSaveError(null)
    const { error } = await saveShopName(shopName.trim())
    setSaving(false)
    if (error) {
      setSaveError(error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleBackup = async () => {
    setBackingUp(true)
    setBackupError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not logged in')

      const [{ data: debtors, error: e1 }, { data: shopSettings, error: e2 }] = await Promise.all([
        supabase.from('debtors').select('*').eq('user_id', session.user.id),
        supabase.from('shop_settings').select('*').eq('user_id', session.user.id),
      ])
      if (e1) throw new Error(e1.message)
      if (e2) throw new Error(e2.message)

      const debtorIds = (debtors ?? []).map((d: { id: string }) => d.id)
      let transactions: unknown[] = []
      if (debtorIds.length > 0) {
        const { data, error: e3 } = await supabase.from('transactions').select('*').in('debtor_id', debtorIds)
        if (e3) throw new Error(e3.message)
        transactions = data ?? []
      }

      const backup = { exported_at: new Date().toISOString(), debtors: debtors ?? [], transactions, shop_settings: shopSettings ?? [] }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <>
      <Navigation />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Settings</h1>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Store size={20} />
              <h2>Shop Name</h2>
            </div>
            <p className={styles.hint}>This name appears on payment reminder images and WhatsApp messages.</p>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.input}
                value={shopName}
                onChange={e => { setShopName(e.target.value); setSaved(false); setSaveError(null) }}
                placeholder="My Shop"
                disabled={loading}
                maxLength={60}
              />
              <button
                className={`btn btn-primary ${styles.saveBtn}`}
                onClick={handleSave}
                disabled={saving || loading || !shopName.trim()}
              >
                <Save size={16} />
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {saveError && (
              <p style={{ color: 'red', marginTop: '8px', fontSize: '14px' }}>
                Save failed: {saveError}
              </p>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Download size={20} />
              <h2>Data Backup</h2>
            </div>
            <p className={styles.hint}>Download all your debtors, transactions, and settings as a JSON file. Store it safely as a manual backup.</p>
            <button
              className={`btn btn-primary ${styles.saveBtn}`}
              onClick={handleBackup}
              disabled={backingUp || loading}
            >
              <Download size={16} />
              {backingUp ? 'Preparing...' : 'Download Backup'}
            </button>
            {backupError && (
              <p style={{ color: 'red', marginTop: '8px', fontSize: '14px' }}>
                {backupError}
              </p>
            )}
          </div>

          <div className={styles.card}>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
