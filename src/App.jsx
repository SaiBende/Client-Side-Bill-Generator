import { useState, useRef } from 'react'
import InvoiceForm from './components/InvoiceForm'
import InvoicePreview from './components/InvoicePreview'
import BlankInvoicePreview from './components/BlankInvoicePreview'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { Download, Share2, FileText, IndianRupee, FileDown, Image } from 'lucide-react'

function generateInvoiceNumber() {
  const prefix = 'INV'
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${num}`
}

function App() {
  const [invoice, setInvoice] = useState({
    businessPhone: '+91 9890495703',
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
    items: [
      { description: '', quantity: 1, rate: 0 },
    ],
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    bankBranch: '',
    terms: '',
    signature: 'Raju Bende',
  })

  const previewRef = useRef(null)
  const blankPreviewRef = useRef(null)
  const [activeTab, setActiveTab] = useState('form')
  const [generating, setGenerating] = useState(false)

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
      items: [...prev.items, { description: '', quantity: 1, rate: 0 }],
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

  function calcGrandTotal() {
    return calcSubtotal() - invoice.discount
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
      scale: 2,
      useCORS: true,
      logging: false,
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

  async function downloadPDF() {
    setGenerating(true)
    try {
      const el = previewRef.current
      if (!el) return
      await captureToPDF(el, `Invoice-${invoice.invoiceNumber}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  async function sharePDF() {
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
    } finally {
      setGenerating(false)
    }
  }

  async function shareImage() {
    setGenerating(true)
    try {
      const el = previewRef.current
      if (!el) return
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
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
    } finally {
      setGenerating(false)
    }
  }

  async function downloadBlankPDF() {
    setGenerating(true)
    try {
      const el = blankPreviewRef.current
      if (!el) return
      await captureToPDF(el, 'Blank-Invoice.pdf')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-800">Invoice Generator</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadPDF} disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Download className="w-4 h-4" /> {generating ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={sharePDF} disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button onClick={shareImage} disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors">
              <Image className="w-4 h-4" /> Share Img
            </button>
            <button onClick={downloadBlankPDF} disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
              <FileDown className="w-4 h-4" /> Blank Bill
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 md:hidden">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setActiveTab('form')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'form' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}>
              <FileText className="w-4 h-4 inline mr-1" /> Form
            </button>
            <button onClick={() => setActiveTab('preview')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600'}`}>
              <FileText className="w-4 h-4 inline mr-1" /> Preview
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div className={`w-full md:w-1/2 ${activeTab === 'preview' ? 'hidden md:block' : ''}`}>
            <InvoiceForm invoice={invoice} updateField={updateField} updateItem={updateItem} addItem={addItem} removeItem={removeItem} />
          </div>
          <div className={`w-full md:w-1/2 ${activeTab === 'form' ? 'hidden md:block' : ''}`}>
            <div className="sticky top-20">
              <InvoicePreview invoice={invoice} calcSubtotal={calcSubtotal} calcGrandTotal={calcGrandTotal} numberToWords={numberToWords} />
            </div>
          </div>
        </div>
      </main>

      <div ref={previewRef} data-capture="true" className="fixed -left-[9999px] top-0 w-[794px]">
        <InvoicePreview invoice={invoice} calcSubtotal={calcSubtotal} calcGrandTotal={calcGrandTotal} numberToWords={numberToWords} />
      </div>
      <div ref={blankPreviewRef} data-capture="true" className="fixed -left-[9999px] top-0 w-[794px]">
        <BlankInvoicePreview businessPhone={invoice.businessPhone} businessEmail={invoice.businessEmail} />
      </div>
    </div>
  )
}

export default App
