'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        if (session) {
          router.push('/dashboard')
        } else {
          router.push('/login')
        }
      } catch (err: any) {
        console.error(err)
        setErrorMsg("Failed to connect to the database. If you have an Adblocker, Brave Shields, or Antivirus Web Shield enabled, it might be blocking the connection to Supabase. Please disable it for localhost and refresh.")
      }
    }
    checkSession()
  }, [router])

  if (errorMsg) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Connection Blocked</h2>
        <p style={{ color: '#4b5563', lineHeight: 1.6 }}>{errorMsg}</p>
      </div>
    )
  }

  return null
}
