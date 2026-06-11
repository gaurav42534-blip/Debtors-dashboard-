'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogOut, Home, Users, Settings } from 'lucide-react'
import styles from './Navigation.module.css'

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContainer}>
        <div className={styles.navBrand}>Supermarket Receivables</div>
        <div className={styles.navLinks}>
          <Link href="/dashboard" className={`${styles.navLink} ${pathname === '/dashboard' ? styles.active : ''}`}>
            <Home size={18} /> Dashboard
          </Link>
          <Link href="/debtors" className={`${styles.navLink} ${pathname === '/debtors' ? styles.active : ''}`}>
            <Users size={18} /> Debtors
          </Link>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </nav>
  )
}
