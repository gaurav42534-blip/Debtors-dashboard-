'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'
import styles from './page.module.css'
import { Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>

      {/* Left brand panel — desktop only */}
      <div className={styles.brandPanel}>
        <div className={styles.brandTop}>
          <div className={styles.brandMark}>₹</div>
          <span className={styles.brandName}>Khata<span>.</span></span>
        </div>
        <div className={styles.brandCenter}>
          <p className={styles.brandTagline}>
            Your shop&apos;s complete<br /><em>receivables manager</em>
          </p>
          <p className={styles.brandDesc}>
            Track every sale, every payment, every customer — all in one place.
          </p>
        </div>
        <div className={styles.brandFeatures}>
          <div className={styles.brandFeature}><span className={styles.brandFeatureDot} />Track outstanding balances in real time</div>
          <div className={styles.brandFeature}><span className={styles.brandFeatureDot} />Send WhatsApp payment reminders</div>
          <div className={styles.brandFeature}><span className={styles.brandFeatureDot} />Works offline with local cache</div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.formPanel}>
        <div className={styles.authCard}>

          <div className={styles.mobileBrand}>
            <div className={styles.mobileBrandMark}>₹</div>
            <span className={styles.mobileBrandName}>Khata<span>.</span></span>
          </div>

          <div className={styles.header}>
            <h1>{isSignUp ? 'Create account' : 'Welcome back'}</h1>
            <p>{isSignUp ? 'Start managing your receivables today.' : 'Sign in to your shop ledger.'}</p>
          </div>

          <form onSubmit={handleAuth} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@store.com" autoComplete="email" spellCheck={false} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete={isSignUp ? 'new-password' : 'current-password'} />
            </div>
            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <><Loader2 size={18} className={styles.spinner} aria-hidden="true" />Signing in…</> : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className={styles.footer}>
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className={styles.toggleBtn}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
