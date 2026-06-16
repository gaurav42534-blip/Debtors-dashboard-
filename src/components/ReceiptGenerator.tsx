'use client'

import { useState, useEffect } from 'react'
import html2canvas from 'html2canvas'
import { X, Send, Download } from 'lucide-react'
import { OverdueDebtor, Transaction } from '@/lib/types'
import { getShopName } from '@/lib/shopSettings'
import styles from './ReceiptGenerator.module.css'

interface ReceiptProps {
  debtor: OverdueDebtor
  onClose: () => void
}

export default function ReceiptGenerator({ debtor, onClose }: ReceiptProps) {
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [shopName, setShopName] = useState('My Shop')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getShopName().then(setShopName)
  }, [])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const element = document.getElementById('receipt-node')
      if (element) {
        // Unhide for rendering
        element.style.display = 'block'
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' })
        element.style.display = 'none'
        
        setImageUrl(canvas.toDataURL('image/png'))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const handleWhatsApp = async () => {
    if (!debtor.phone || !imageUrl) return

    const amount = formatCurrency(debtor.overdueAmount)
    const message = `🙏 नमस्कार ${debtor.name} जी!\n\nतुमची उधारी ${amount} झाली आहे.\n\nहिशोब सोबतच्या फोटोत आहे.\n\nधन्यवाद! 🙏\n— ${shopName}`

    let phone = debtor.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (isMobile && navigator.share && navigator.canShare) {
      // Mobile: use Web Share API to share image + text directly
      try {
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const file = new File([blob], `Reminder_${debtor.name}.png`, { type: 'image/png' })
        const shareData = { text: message, files: [file] }
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          return
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }

    // Desktop: copy image to clipboard, then open WhatsApp Web to the contact
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      setTimeout(() => setCopied(false), 4000)
    } catch {
      // clipboard write not supported — user can manually copy
    }
    window.open(waUrl, '_blank')
  }

  // Calculate breakdown for receipt preview
  const now = new Date()
  const sales = debtor.transactions?.filter((tx: Transaction) => tx.type === 'sale').sort((a: Transaction, b: Transaction) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()) || []
  const payments = debtor.transactions?.filter((tx: Transaction) => tx.type === 'payment') || []
  let remainingPayment = payments.reduce((acc: number, curr: Transaction) => acc + Number(curr.amount), 0)
  
  const overdueSales: (Transaction & { unpaidAmount: number })[] = []
  for (const sale of sales) {
    if (remainingPayment >= Number(sale.amount)) {
      remainingPayment -= Number(sale.amount)
    } else {
      const unpaidPortion = Number(sale.amount) - remainingPayment
      remainingPayment = 0
      
      const saleDate = new Date(sale.transaction_date)
      const dueDate = new Date(saleDate)
      dueDate.setDate(dueDate.getDate() + debtor.default_terms)
      
      if (now > dueDate) {
        overdueSales.push({ ...sale, unpaidAmount: unpaidPortion })
      }
    }
  }

  const lastPayment = [...payments].sort((a: Transaction, b: Transaction) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())[0]

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Generate Reminder</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.content}>
          {/* Hidden element to generate the image from */}
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
            <div id="receipt-node" className={styles.receipt}>
              <div className={styles.rHeader}>
                <h2>{shopName}</h2>
                <p>उधारीची चिठ्ठी</p>
              </div>
              <div className={styles.rBody}>
                <p><strong>नाव:</strong> {debtor.name}</p>
                <p><strong>तारीख:</strong> {new Date().toLocaleDateString('en-IN')}</p>

                <div className={styles.rAmountBox}>
                  <p>एकूण उधारी</p>
                  <h1>{formatCurrency(debtor.overdueAmount)}</h1>
                </div>

                {overdueSales.length > 0 && (
                  <div className={styles.rBreakdown}>
                    <h4>उधारीचा हिशोब:</h4>
                    <table className={styles.rTable}>
                      <thead>
                        <tr>
                          <th>तारीख</th>
                          <th>नोंद</th>
                          <th style={{ textAlign: 'right' }}>बाकी रक्कम</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overdueSales.map(s => (
                          <tr key={s.id}>
                            <td>{new Date(s.transaction_date).toLocaleDateString('en-IN')}</td>
                            <td>{s.ref_note || '-'}</td>
                            <td style={{ textAlign: 'right' }}>{formatCurrency(s.unpaidAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {lastPayment && (
                  <div className={styles.rLastPayment}>
                    <strong>शेवटची रक्कम मिळाली:</strong><br />
                    {formatCurrency(Number(lastPayment.amount))} — {new Date(lastPayment.transaction_date).toLocaleDateString('en-IN')}
                  </div>
                )}
              </div>
              <div className={styles.rFooter}>
                येत राहा, धन्यवाद! 😊
              </div>
            </div>
          </div>

          {!imageUrl ? (
            <div className={styles.generateState}>
              <p><strong>{debtor.name}</strong> यांच्यासाठी उधारीची चिठ्ठी तयार करा.</p>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Generate Photo'}
              </button>
            </div>
          ) : (
            <div className={styles.previewState}>
              <div className={styles.imagePreview}>
                <img src={imageUrl} alt="Receipt Preview" />
              </div>
              <div className={styles.actions}>
                <a href={imageUrl} download={`Reminder_${debtor.name}.png`} className="btn" style={{ border: '1px solid var(--border)' }}>
                  <Download size={18} /> Download
                </a>
                <button className="btn" style={{ background: '#25D366', color: 'white' }} onClick={handleWhatsApp}>
                  <Send size={18} /> Share on WhatsApp
                </button>
              </div>
              <p className={styles.helperText}>
                {copied
                  ? '🙏 Image copied! WhatsApp is opening — just press Ctrl+V to paste it.'
                  : 'On phone, image shares directly. On desktop, image is copied to clipboard — just paste it in the chat.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
