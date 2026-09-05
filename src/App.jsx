import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { supabase } from './lib/supabase'
import { getStoredLogo, getStoredLogoSettings, storeLogo, storeLogoSettings, clearStoredLogo, resizeLogo } from './lib/logo'
import AuthModal from './components/auth/AuthModal'
import Dashboard from './components/Dashboard'
import InvoiceForm from './components/InvoiceForm'
import InvoicePreview from './components/InvoicePreview'
import BlankInvoicePreview from './components/BlankInvoicePreview'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { Download, Share2, IndianRupee, FileDown, Image, LogIn, LayoutDashboard, Plus, Home, ArrowLeft, Link } from 'lucide-react'

function generateInvoiceNumber() {
  const prefix = 'INV'
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${num}`
}

const defaultInvoice = {
  businessName: '',
  businessAddress: '',
  businessPhone: '',
  businessEmail: '',
  customerName: '',
  customerAddress: '',
  customerCity: '',
  customerState: '',
  customerPincode: '',
  invoiceNumber: generateInvoiceNumber(),
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  discount: 0,
  enableGst: false,
  gstin: '',
  items: [{ description: '', quantity: 1, rate: 0, hsn: '', gstRate: 0 }],
  bankName: '',
  bankAccount: '',
  bankIfsc: '',
  bankBranch: '',
  upiId: '',
  upiName: '',
  terms: '',
  signature: '',
}

const BUSINESS_DEFAULTS_KEY = 'billing_business_defaults'

function getBusinessDefaultsFromLocal() {
  try {
    const raw = localStorage.getItem(BUSINESS_DEFAULTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveBusinessDefaultsToLocal(defaults) {
  try {
    localStorage.setItem(BUSINESS_DEFAULTS_KEY, JSON.stringify(defaults))
  } catch {
  }
}

function businessDefaultsFromProfile(data) {
  return {
    businessName: data.business_name || '',
    businessAddress: data.business_address || '',
    businessPhone: data.business_phone || '',
    businessEmail: data.business_email || '',
    bankName: data.bank_name || '',
    bankAccount: data.bank_account || '',
    bankIfsc: data.bank_ifsc || '',
    bankBranch: data.bank_branch || '',
    upiId: data.upi_id || '',
    upiName: data.upi_name || '',
    gstin: data.gstin || '',
  }
}

function SharedInvoiceView({ token, onClose }) {
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)

  useEffect(() => {
    supabase.rpc('get_shared_invoice', { token }).single().then(({ data }) => {
      if (data) setInvoice(data)
      else setError(true)
      setLoading(false)
    })
  }, [token])

  useEffect(() => {
    if (!invoice?.upi_id) return
    const amount = (invoice.items || []).reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0) - (invoice.discount || 0)
    const upiLink = `upi://pay?pa=${encodeURIComponent(invoice.upi_id)}&pn=${encodeURIComponent(invoice.upi_name || invoice.business_name || 'Business')}&am=${amount.toFixed(2)}&tn=${encodeURIComponent(invoice.invoice_number || 'Invoice')}&cu=INR`
    QRCode.toDataURL(upiLink, { width: 250, margin: 2, color: { dark: '#1e3a5f', light: '#ffffff' } }).then(setQrDataUrl)
  }, [invoice])

  function calcSubtotal() {
    if (!invoice?.items) return 0
    return invoice.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0)
  }
  function calcTaxable() { return invoice?.enable_gst ? calcSubtotal() : 0 }
  function calcGstRate() {
    const rates = invoice?.items?.map(i => i.gstRate || 0) || [0]
    return Math.max(...rates)
  }
  function calcCgst() { return invoice?.enable_gst ? calcTaxable() * calcGstRate() / 200 : 0 }
  function calcSgst() { return calcCgst() }
  function calcGrandTotal() {
    const taxable = calcSubtotal()
    if (!invoice?.enable_gst) return taxable - (invoice?.discount || 0)
    return taxable + calcCgst() + calcSgst() - (invoice?.discount || 0)
  }
  function numberToWords(num) {
    if (num === 0) return 'Zero'
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const fn = (n) => {
      if (n < 20) return a[n]
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + fn(n % 100) : '')
      if (n < 100000) return fn(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + fn(n % 1000) : '')
      if (n < 10000000) return fn(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + fn(n % 100000) : '')
      return fn(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + fn(n % 10000000) : '')
    }
    const [rupees, paise] = num.toFixed(2).split('.')
    let result = fn(parseInt(rupees)) + ' Rupees'
    if (parseInt(paise) > 0) result += ' and ' + fn(parseInt(paise)) + ' Paise'
    return result + ' Only'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading invoice...</div>
  if (error || !invoice) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <IndianRupee className="w-12 h-12 text-gray-300 mb-3" />
      <h2 className="text-lg font-semibold text-gray-800">Invoice not found</h2>
      <p className="text-sm text-gray-500 mt-1">This link may be invalid or the invoice was deleted.</p>
      <button onClick={onClose} className="mt-4 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">Go to Invoice Generator</button>
    </div>
  )

  const formInvoice = {
    businessName: invoice.business_name,
    businessAddress: invoice.business_address,
    businessPhone: invoice.business_phone,
    businessEmail: invoice.business_email,
    customerName: invoice.customer_name,
    customerAddress: invoice.customer_address,
    customerCity: invoice.customer_city,
    customerState: invoice.customer_state,
    customerPincode: invoice.customer_pincode,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    discount: invoice.discount,
    items: invoice.items,
    bankName: invoice.bank_name,
    bankAccount: invoice.bank_account,
    bankIfsc: invoice.bank_ifsc,
    bankBranch: invoice.bank_branch,
    upiId: invoice.upi_id,
    upiName: invoice.upi_name,
    terms: invoice.terms,
    signature: invoice.signature,
  }

  const grandTotal = calcGrandTotal()
  const hasUPI = invoice.upi_id
  const upiDeepLink = hasUPI ? `upi://pay?pa=${encodeURIComponent(invoice.upi_id)}&pn=${encodeURIComponent(invoice.upi_name || invoice.business_name || 'Business')}&am=${grandTotal.toFixed(2)}&tn=${encodeURIComponent(invoice.invoice_number || 'Invoice')}&cu=INR` : ''

  function payWithUPI() { window.location.href = upiDeepLink }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-blue-600" />
          <h1 className="text-sm font-bold text-gray-800">Shared Invoice</h1>
          <span className="ml-auto text-xs text-gray-400">View only</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <InvoicePreview invoice={formInvoice} calcSubtotal={calcSubtotal} calcGrandTotal={calcGrandTotal} calcCgst={calcCgst} calcSgst={calcSgst} numberToWords={numberToWords} />
        </div>

        {hasUPI && (
          <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Pay with UPI</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {qrDataUrl && (
                <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm shrink-0">
                  <img src={qrDataUrl} alt="UPI QR Code" className="w-44 h-44" />
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm text-gray-600 mb-1">Payee: <span className="font-medium text-gray-900">{invoice.upi_name || invoice.business_name || 'Business'}</span></p>
                <p className="text-sm text-gray-600 mb-3">UPI ID: <span className="font-medium text-gray-900">{invoice.upi_id}</span></p>
                <p className="text-lg font-bold text-gray-900 mb-3">Amount: ₹{grandTotal.toFixed(2)}</p>
                <button onClick={payWithUPI}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  Pay Online
                </button>
                <p className="text-[10px] text-gray-400 mt-2">Opens your default UPI app</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('editor')
  const [editInvoiceId, setEditInvoiceId] = useState(null)
  const [invoice, setInvoice] = useState({ ...defaultInvoice, invoiceNumber: generateInvoiceNumber() })
  const previewRef = useRef(null)
  const blankPreviewRef = useRef(null)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('form')
  const [saving, setSaving] = useState(false)
  const [shareToken, setShareToken] = useState(null)
  const [isSharedView, setIsSharedView] = useState(false)

  const [logo, setLogo] = useState(getStoredLogo)
  const [logoSettings, setLogoSettings] = useState(getStoredLogoSettings)

  const [showAuth, setShowAuth] = useState(false)
  const [toast, setToast] = useState(null)
  const pendingActionRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('share')
    if (token) { setIsSharedView(true); setShareToken(token); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfileDefaultsToInvoice(session.user.id)
      } else {
        applyBusinessDefaults(getBusinessDefaultsFromLocal())
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        loadProfileDefaultsToInvoice(session.user.id)
      } else {
        setView('editor')
        setEditInvoiceId(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfileDefaultsToInvoice(userId) {
    const { data } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single()
    applyBusinessDefaults(data ? businessDefaultsFromProfile(data) : getBusinessDefaultsFromLocal())
  }

  function applyBusinessDefaults(defaults) {
    if (!defaults || !defaults.businessName) return
    setInvoice(prev => prev.businessName ? prev : {
      ...prev,
      businessName: defaults.businessName || '',
      businessAddress: defaults.businessAddress || '',
      businessPhone: defaults.businessPhone || '',
      businessEmail: defaults.businessEmail || '',
      bankName: defaults.bankName || '',
      bankAccount: defaults.bankAccount || '',
      bankIfsc: defaults.bankIfsc || '',
      bankBranch: defaults.bankBranch || '',
      upiId: defaults.upiId || '',
      upiName: defaults.upiName || '',
      gstin: defaults.gstin || '',
    })
  }

  useEffect(() => {
    if (!invoice.businessName) return
    saveBusinessDefaultsToLocal({
      businessName: invoice.businessName,
      businessAddress: invoice.businessAddress,
      businessPhone: invoice.businessPhone,
      businessEmail: invoice.businessEmail,
      bankName: invoice.bankName,
      bankAccount: invoice.bankAccount,
      bankIfsc: invoice.bankIfsc,
      bankBranch: invoice.bankBranch,
      upiId: invoice.upiId,
      upiName: invoice.upiName,
      gstin: invoice.gstin,
    })
  }, [invoice.businessName, invoice.businessAddress, invoice.businessPhone, invoice.businessEmail, invoice.bankName, invoice.bankAccount, invoice.bankIfsc, invoice.bankBranch, invoice.upiId, invoice.upiName, invoice.gstin])

  useEffect(() => {
    if (session && pendingActionRef.current) {
      const fn = pendingActionRef.current
      pendingActionRef.current = null
      setShowAuth(false)
      fn()
    }
  }, [session])

  function requireAuth(callback) {
    if (session) {
      callback()
    } else {
      pendingActionRef.current = callback
      setShowAuth(true)
    }
  }

  async function uploadLogo(file) {
    if (!file) return
    const dataUrl = await resizeLogo(file)
    if (dataUrl) {
      setLogo(dataUrl)
      storeLogo(dataUrl)
    }
  }

  function removeLogo() {
    setLogo(null)
    clearStoredLogo()
  }

  function updateLogoSettings(partial) {
    const next = { ...logoSettings, ...partial }
    setLogoSettings(next)
    storeLogoSettings(next)
  }

  async function loadInvoice(id) {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (!error && data) {
      setInvoice({
        businessName: data.business_name || '',
        businessAddress: data.business_address || '',
        businessPhone: data.business_phone || '',
        businessEmail: data.business_email || '',
        customerName: data.customer_name || '',
        customerAddress: data.customer_address || '',
        customerCity: data.customer_city || '',
        customerState: data.customer_state || '',
        customerPincode: data.customer_pincode || '',
        invoiceNumber: data.invoice_number,
        invoiceDate: data.invoice_date,
        dueDate: data.due_date || '',
        discount: data.discount || 0,
        enableGst: data.enable_gst || false,
        gstin: data.gstin || '',
        items: data.items || [{ description: '', quantity: 1, rate: 0, hsn: '', gstRate: 0 }],
        bankName: data.bank_name || '',
        bankAccount: data.bank_account || '',
        bankIfsc: data.bank_ifsc || '',
        bankBranch: data.bank_branch || '',
        upiId: data.upi_id || '',
        upiName: data.upi_name || '',
        terms: data.terms || '',
        signature: data.signature || '',
      })
      setEditInvoiceId(id)
      setShareToken(data.share_token)
      setView('editor')
      setActiveTab('form')
    }
  }

  async function handleNewInvoice() {
    const base = { ...defaultInvoice, invoiceNumber: generateInvoiceNumber() }
    let defaults = getBusinessDefaultsFromLocal()
    if (session) {
      const { data } = await supabase.from('user_profiles').select('*').eq('user_id', session.user.id).single()
      if (data) defaults = businessDefaultsFromProfile(data)
    }
    Object.assign(base, defaults)
    setInvoice(base)
    setEditInvoiceId(null)
    setView('editor')
    setActiveTab('form')
  }

  function openDashboard() {
    requireAuth(() => {
      setView('dashboard')
      setEditInvoiceId(null)
    })
  }

  function handleBack() {
    if (session) {
      setView('dashboard')
    }
    setEditInvoiceId(null)
  }

  function updateField(field, value) {
    setInvoice(prev => ({ ...prev, [field]: value }))
  }

  function updateItem(index, field, value) {
    setInvoice(prev => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  function addItem() {
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0, hsn: '', gstRate: 0 }],
    }))
  }

  function removeItem(index) {
    setInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  function calcSubtotal() {
    return invoice.items.reduce((sum, item) => sum + item.quantity * item.rate, 0)
  }

  function calcGstRate() {
    return Math.max(...invoice.items.map(i => i.gstRate || 0))
  }

  function calcCgst() { return invoice.enableGst ? calcSubtotal() * calcGstRate() / 200 : 0 }
  function calcSgst() { return calcCgst() }

  function calcGrandTotal() {
    const taxable = calcSubtotal()
    if (!invoice.enableGst) return taxable - invoice.discount
    return taxable + calcCgst() + calcSgst() - invoice.discount
  }

  async function saveInvoiceToDB() {
    const grandTotal = calcGrandTotal()
    const payload = {
      user_id: session.user.id,
      business_name: invoice.businessName,
      business_address: invoice.businessAddress,
      business_phone: invoice.businessPhone,
      business_email: invoice.businessEmail,
      customer_name: invoice.customerName,
      customer_address: invoice.customerAddress,
      customer_city: invoice.customerCity,
      customer_state: invoice.customerState,
      customer_pincode: invoice.customerPincode,
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      due_date: invoice.dueDate || null,
      discount: invoice.discount,
      enable_gst: invoice.enableGst,
      gstin: invoice.gstin,
      items: invoice.items,
      grand_total: grandTotal,
      bank_name: invoice.bankName,
      bank_account: invoice.bankAccount,
      bank_ifsc: invoice.bankIfsc,
      bank_branch: invoice.bankBranch,
      upi_id: invoice.upiId,
      upi_name: invoice.upiName,
      terms: invoice.terms,
      signature: invoice.signature,
      status: 'pending',
    }
    if (editInvoiceId) {
      await supabase.from('invoices').update(payload).eq('id', editInvoiceId)
    } else {
      const { data } = await supabase.from('invoices').insert(payload).select('id, share_token').single()
      if (data) { setEditInvoiceId(data.id); setShareToken(data.share_token) }
    }
    await supabase.from('user_profiles').upsert({
      user_id: session.user.id,
      business_name: invoice.businessName,
      business_address: invoice.businessAddress,
      business_phone: invoice.businessPhone,
      business_email: invoice.businessEmail,
      bank_name: invoice.bankName,
      bank_account: invoice.bankAccount,
      bank_ifsc: invoice.bankIfsc,
      bank_branch: invoice.bankBranch,
      upi_id: invoice.upiId,
      upi_name: invoice.upiName,
      gstin: invoice.gstin,
    }, { onConflict: 'user_id' })
  }

  async function saveInvoice() {
    setSaving(true)
    await saveInvoiceToDB()
    setSaving(false)
    setToast('Invoice saved successfully!')
    setTimeout(() => setToast(null), 3000)
  }

  function handleSaveClick() {
    requireAuth(() => saveInvoice())
  }

  function copyShareLink() {
    if (!shareToken) return
    const url = `${window.location.origin}?share=${shareToken}`
    navigator.clipboard.writeText(url).then(() => {
      setToast('Share link copied!')
      setTimeout(() => setToast(null), 3000)
    })
  }

  function numberToWords(num) {
    if (num === 0) return 'Zero'
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const fn = (n) => {
      if (n < 20) return a[n]
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + fn(n % 100) : '')
      if (n < 100000) return fn(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + fn(n % 1000) : '')
      if (n < 10000000) return fn(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + fn(n % 100000) : '')
      return fn(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + fn(n % 10000000) : '')
    }
    const [rupees, paise] = num.toFixed(2).split('.')
    let result = fn(parseInt(rupees)) + ' Rupees'
    if (parseInt(paise) > 0) result += ' and ' + fn(parseInt(paise)) + ' Paise'
    return result + ' Only'
  }

  async function captureToPDF(el, filename) {
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, logging: false,
      onclone: (doc) => {
        doc.querySelectorAll('*').forEach(n => {
          n.style.wordSpacing = '1px'
          n.style.letterSpacing = '0.3px'
        })
        const captureEl = doc.querySelector('[data-capture]')
        if (captureEl) {
          captureEl.style.left = '0'
          captureEl.style.position = 'fixed'
          captureEl.style.top = '0'
          captureEl.style.opacity = '1'
        }
      },
    })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const imgWidth = 210
    const pageHeight = 297
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pdf = new jsPDF('p', 'mm', 'a4')
    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    if (filename) pdf.save(filename)
    return pdf
  }

  function downloadPDF() {
    requireAuth(async () => {
      await saveInvoiceToDB()
      setGenerating(true)
      try {
        const el = previewRef.current
        if (!el) return
        await captureToPDF(el, `Invoice-${invoice.invoiceNumber}.pdf`)
      } finally { setGenerating(false) }
    })
  }

  function sharePDF() {
    requireAuth(async () => {
      await saveInvoiceToDB()
      setGenerating(true)
      try {
        const el = previewRef.current
        if (!el) return
        const pdf = await captureToPDF(el)
        if (!pdf) return
        const pdfBlob = pdf.output('blob')
        const file = new File([pdfBlob], `Invoice-${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' })
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Invoice ${invoice.invoiceNumber}` })
        } else {
          const url = URL.createObjectURL(pdfBlob)
          window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 10000)
        }
      } finally { setGenerating(false) }
    })
  }

  function shareImage() {
    requireAuth(async () => {
      await saveInvoiceToDB()
      setGenerating(true)
      try {
        const el = previewRef.current
        if (!el) return
        const canvas = await html2canvas(el, {
          scale: 2, useCORS: true, logging: false,
          onclone: (doc) => {
            doc.querySelectorAll('*').forEach(n => {
              n.style.wordSpacing = '1px'
              n.style.letterSpacing = '0.3px'
            })
            const captureEl = doc.querySelector('[data-capture]')
            if (captureEl) {
              captureEl.style.left = '0'
              captureEl.style.position = 'fixed'
              captureEl.style.top = '0'
              captureEl.style.opacity = '1'
            }
          },
        })
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        if (!blob) return
        const file = new File([blob], `Invoice-${invoice.invoiceNumber}.png`, { type: 'image/png' })
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Invoice ${invoice.invoiceNumber}` })
        } else {
          const url = URL.createObjectURL(blob)
          window.open(url, '_blank')
          setTimeout(() => URL.revokeObjectURL(url), 10000)
        }
      } finally { setGenerating(false) }
    })
  }

  function downloadBlankPDF() {
    requireAuth(async () => {
      await saveInvoiceToDB()
      setGenerating(true)
      try {
        const el = blankPreviewRef.current
        if (!el) return
        await captureToPDF(el, 'Blank-Invoice.pdf')
      } finally { setGenerating(false) }
    })
  }

  if (isSharedView) {
    return <SharedInvoiceView token={shareToken} onClose={() => { setIsSharedView(false); setShareToken(null); window.history.replaceState({}, '', '/') }} />
  }

  const isEditor = view === 'editor' || !session

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* ---- HEADER ---- */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
            {session && view === 'editor' && (
              <button onClick={handleBack} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0" title="Back to Dashboard">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <IndianRupee className="w-5 h-5 md:w-6 md:h-6 text-blue-600 shrink-0" />
            <h1 className="text-sm md:text-lg font-bold text-gray-800 truncate">
              {editInvoiceId ? 'Edit Invoice' : 'Invoice Generator'}
            </h1>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-2 items-center">
            {session ? (
              <button onClick={openDashboard}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              ><LayoutDashboard className="w-4 h-4" /><span>My Invoices</span>
              </button>
            ) : (
              <button onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium"
              ><LogIn className="w-4 h-4" /><span>Sign In</span>
              </button>
            )}
            {isEditor && <>
              <button onClick={handleSaveClick} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >{saving ? 'Saving...' : editInvoiceId ? 'Update' : 'Save'}</button>
              <button onClick={downloadPDF} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              ><Download className="w-4 h-4" /><span>{generating ? '...' : 'PDF'}</span></button>
              <button onClick={sharePDF} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              ><Share2 className="w-4 h-4" /><span>Share</span></button>
              <button onClick={shareImage} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
              ><Image className="w-4 h-4" /><span>Img</span></button>
              <button onClick={downloadBlankPDF} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              ><FileDown className="w-4 h-4" /><span>Blank</span></button>
              {shareToken && (
                <button onClick={copyShareLink}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                ><Link className="w-4 h-4" /><span>Copy Link</span></button>
              )}
            </>}
          </div>
        </div>

        {/* Mobile tabs + actions */}
        {isEditor && <>
          <div className="max-w-7xl mx-auto px-3 pb-2 flex items-center gap-2 md:hidden">
            <div className="flex bg-gray-100 rounded-lg p-0.5 flex-1">
              <button onClick={() => setActiveTab('form')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'form' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
              >Form</button>
              <button onClick={() => setActiveTab('preview')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}
              >Preview</button>
            </div>
            <button onClick={handleSaveClick} disabled={saving}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            >{saving ? '...' : editInvoiceId ? 'Update' : 'Save'}</button>
          </div>
          <div className="max-w-7xl mx-auto px-3 pb-2 flex gap-1.5 overflow-x-auto md:hidden scrollbar-none">
            <button onClick={downloadPDF} disabled={generating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
            ><Download className="w-3.5 h-3.5" /> PDF</button>
            <button onClick={sharePDF} disabled={generating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
            ><Share2 className="w-3.5 h-3.5" /> Share</button>
            <button onClick={shareImage} disabled={generating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors shrink-0"
            ><Image className="w-3.5 h-3.5" /> Img</button>
            <button onClick={downloadBlankPDF} disabled={generating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors shrink-0"
            ><FileDown className="w-3.5 h-3.5" /> Blank</button>
            {shareToken && (
              <button onClick={copyShareLink}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors shrink-0"
              ><Link className="w-3.5 h-3.5" /> Link</button>
            )}
          </div>
        </>}
      </header>

      {/* ---- MAIN CONTENT ---- */}
      {view === 'dashboard' && session ? (
        <Dashboard
          user={session.user}
          onSignOut={() => supabase.auth.signOut()}
          onNewInvoice={handleNewInvoice}
          onEditInvoice={loadInvoice}
          onToast={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }}
          onCopyLink={(token) => {
            const url = `${window.location.origin}?share=${token}`
            navigator.clipboard.writeText(url).then(() => {
              setToast('Share link copied!')
              setTimeout(() => setToast(null), 3000)
            })
          }}
        />
      ) : (
        <main className="max-w-7xl mx-auto p-3 md:p-4">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            <div className={`w-full md:w-1/2 ${activeTab === 'preview' ? 'hidden md:block' : ''}`}>
              <InvoiceForm invoice={invoice} updateField={updateField} updateItem={updateItem} addItem={addItem} removeItem={removeItem} logo={logo} logoSettings={logoSettings} onUploadLogo={uploadLogo} onRemoveLogo={removeLogo} onLogoSettingsChange={updateLogoSettings} />
            </div>
            <div className={`w-full md:w-1/2 ${activeTab === 'form' ? 'hidden md:block' : ''}`}>
              <div className="md:sticky md:top-20">
<InvoicePreview invoice={invoice} calcSubtotal={calcSubtotal} calcGrandTotal={calcGrandTotal} calcCgst={calcCgst} calcSgst={calcSgst} numberToWords={numberToWords} logo={logo} logoSettings={logoSettings} />
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ---- MOBILE BOTTOM NAV ---- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex items-center justify-around safe-area-bottom">
        <button onClick={() => { if (session) { setView('dashboard'); setEditInvoiceId(null) } else { setShowAuth(true) } }}
          className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium ${view === 'dashboard' ? 'text-blue-600' : 'text-gray-500'}`}
        ><Home className="w-5 h-5" /> Home</button>
        <button onClick={() => handleNewInvoice()}
          className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium ${view === 'editor' && !editInvoiceId ? 'text-blue-600' : 'text-gray-500'}`}
        ><Plus className="w-5 h-5" /> New</button>
        {session ? (
          <button onClick={() => supabase.auth.signOut()}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium text-gray-500"
          ><LogIn className="w-5 h-5" /> Sign Out</button>
        ) : (
          <button onClick={() => setShowAuth(true)}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium text-blue-600"
          ><LogIn className="w-5 h-5" /> Sign In</button>
        )}
      </nav>

      {/* ---- HIDDEN CAPTURE ELEMENTS ---- */}
      <div ref={previewRef} data-capture="true" className="fixed -left-[9999px] top-0 w-[794px]">
        <InvoicePreview invoice={invoice} calcSubtotal={calcSubtotal} calcGrandTotal={calcGrandTotal} calcCgst={calcCgst} calcSgst={calcSgst} numberToWords={numberToWords} logo={logo} logoSettings={logoSettings} />
      </div>
      <div ref={blankPreviewRef} data-capture="true" className="fixed -left-[9999px] top-0 w-[794px]">
        <BlankInvoicePreview businessName={invoice.businessName} businessAddress={invoice.businessAddress} businessPhone={invoice.businessPhone} businessEmail={invoice.businessEmail} logo={logo} logoSettings={logoSettings} />
      </div>

      {/* ---- MODALS & TOASTS ---- */}
      <AuthModal open={showAuth} onClose={() => { setShowAuth(false); pendingActionRef.current = null }} />

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2.5 md:px-5 md:py-3 rounded-lg shadow-lg text-xs md:text-sm font-medium animate-slide-in">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
