'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Save, Store } from 'lucide-react'
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
