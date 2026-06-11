'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogOut, Home, Users, Sun, Moon } from 'lucide-react'
import styles from './Navigation.module.css'

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const prefersDark = saved === 'dark'
    setIsDark(prefersDark)
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light')
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <div className={styles.navBrand}>Supermarket Receivables</div>
        
        {/* Desktop nav links */}
        <div className={styles.navLinksDesktop}>
          <Link href="/dashboard" className={`${styles.navLink} ${pathname === '/dashboard' ? styles.active : ''}`}>
            <Home size={18} /> Dashboard
          </Link>
          <Link href="/debtors" className={`${styles.navLink} ${pathname === '/debtors' ? styles.active : ''}`}>
            <Users size={18} /> Debtors
          </Link>
        </div>

        <div className={styles.navActions}>
          <button onClick={toggleTheme} className={styles.themeToggle} aria-label="Toggle theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={18} /> <span className={styles.logoutLabel}>Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className={styles.bottomBar}>
        <Link href="/dashboard" className={`${styles.bottomTab} ${pathname === '/dashboard' ? styles.bottomTabActive : ''}`}>
          <Home size={20} />
          <span>Dashboard</span>
        </Link>
        <Link href="/debtors" className={`${styles.bottomTab} ${pathname === '/debtors' ? styles.bottomTabActive : ''}`}>
          <Users size={20} />
          <span>Debtors</span>
        </Link>
        <button onClick={toggleTheme} className={styles.bottomTab} aria-label="Toggle theme">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span>Theme</span>
        </button>
        <button onClick={handleLogout} className={styles.bottomTab}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  )
}
