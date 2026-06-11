'use client'

import { useState } from 'react'
import html2canvas from 'html2canvas'
import { X, Send, Download } from 'lucide-react'
import styles from './ReceiptGenerator.module.css'

interface ReceiptProps {
  debtor: any;
  onClose: () => void;
}

export default function ReceiptGenerator({ debtor, onClose }: ReceiptProps) {
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

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

  const handleWhatsApp = () => {
    if (!debtor.phone) return
    let phone = debtor.phone.replace(/\D/g, '')
    if (phone.length === 10) phone = '91' + phone
    const text = encodeURIComponent("Hi! This is a friendly reminder to clear your pending dues. Please find the details attached. Thank you!")
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
  }

  // Calculate breakdown for receipt preview
  const now = new Date()
  const sales = debtor.transactions?.filter((tx: any) => tx.type === 'sale').sort((a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()) || []
  const payments = debtor.transactions?.filter((tx: any) => tx.type === 'payment') || []
  let remainingPayment = payments.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
  
  let overdueSales: any[] = []
  for (let sale of sales) {
    if (remainingPayment >= Number(sale.amount)) {
      remainingPayment -= Number(sale.amount)
    } else {
      let unpaidPortion = Number(sale.amount) - remainingPayment
      remainingPayment = 0
      
      let saleDate = new Date(sale.transaction_date)
      let dueDate = new Date(saleDate)
      dueDate.setDate(dueDate.getDate() + debtor.default_terms)
      
      if (now > dueDate) {
        overdueSales.push({ ...sale, unpaidAmount: unpaidPortion })
      }
    }
  }

  const lastPayment = payments.sort((a: any, b: any) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())[0]

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
                <h2>Supermarket Receivables</h2>
                <p>Payment Reminder</p>
              </div>
              <div className={styles.rBody}>
                <p><strong>To:</strong> {debtor.name}</p>
                <p><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
                
                <div className={styles.rAmountBox}>
                  <p>Total Overdue</p>
                  <h1>{formatCurrency(debtor.overdueAmount)}</h1>
                </div>

                {overdueSales.length > 0 && (
                  <div className={styles.rBreakdown}>
                    <h4>Overdue Breakdown:</h4>
                    <table className={styles.rTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Ref</th>
                          <th style={{ textAlign: 'right' }}>Unpaid</th>
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
                    <strong>Last Payment Received:</strong><br />
                    {formatCurrency(Number(lastPayment.amount))} on {new Date(lastPayment.transaction_date).toLocaleDateString('en-IN')}
                  </div>
                )}

                <p className={styles.rDetails}>Please clear your pending dues at the earliest.</p>
              </div>
              <div className={styles.rFooter}>
                Thank you for your business!
              </div>
            </div>
          </div>

          {!imageUrl ? (
            <div className={styles.generateState}>
              <p>Ready to generate a professional payment reminder photo for <strong>{debtor.name}</strong>.</p>
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
              <p className={styles.helperText}>After clicking Share on WhatsApp, simply paste (Ctrl+V) the downloaded image into the chat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
