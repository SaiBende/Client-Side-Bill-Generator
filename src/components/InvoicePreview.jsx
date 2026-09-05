import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function InvoicePreview({ invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst, numberToWords, logo, logoSettings }) {
  const logoStyle = logoSettings || { position: 'center', width: 80, height: 80 }
  const grandTotal = calcGrandTotal()
  const taxable = calcSubtotal()
  const cgst = calcCgst ? calcCgst() : 0
  const sgst = calcSgst ? calcSgst() : 0
  const gstRate = Math.max(...(invoice.items || []).map(i => i.gstRate || 0))
  const [qrDataUrl, setQrDataUrl] = useState(null)

  useEffect(() => {
    if (!invoice.upiId) { setQrDataUrl(null); return }
    const upiLink = `upi://pay?pa=${encodeURIComponent(invoice.upiId)}&pn=${encodeURIComponent(invoice.upiName || invoice.businessName || 'Business')}&am=${grandTotal.toFixed(2)}&tn=${encodeURIComponent(invoice.invoiceNumber || 'Invoice')}&cu=INR`
    QRCode.toDataURL(upiLink, { width: 160, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } }).then(setQrDataUrl)
  }, [invoice.upiId, invoice.upiName, invoice.businessName, grandTotal, invoice.invoiceNumber])

  const alignClass = logoStyle.position === 'left' ? 'justify-start' : logoStyle.position === 'right' ? 'justify-end' : 'justify-center'

  return (
    <div className="bg-white border border-gray-300 text-sm text-gray-800">
      <div className="p-4">
        <div className="text-center mb-2">
          {logo && (
            <div className={`flex mb-1 ${alignClass}`}>
              <img src={logo} alt="Business Logo" className="object-fill" style={{ width: logoStyle.width, height: logoStyle.height }} />
            </div>
          )}
          <h2 className="text-lg md:text-xl font-extrabold text-gray-900 uppercase break-words tracking-wide">{invoice.businessName || 'Your Business Name'}</h2>
          <p className="text-[13px] text-gray-600 leading-snug whitespace-pre">{invoice.businessAddress || 'Your Address'}</p>
          {invoice.businessPhone && <p className="text-[13px] text-gray-600">Phone: {invoice.businessPhone}</p>}
          {invoice.businessEmail && <p className="text-[13px] text-gray-600">Email: {invoice.businessEmail}</p>}
        </div>

        <hr className="border-t-2 border-gray-900 my-2" />

        <div className="flex flex-col md:flex-row justify-between gap-3 mb-2">
          <div className="border border-gray-300 p-2 rounded flex-1">
            <h3 className="font-bold text-gray-900 mb-0.5 text-sm">Bill To:</h3>
            <p className="font-semibold text-gray-800 break-words text-sm">{invoice.customerName || 'Customer Name'}</p>
            <p className="text-[13px] text-gray-600 break-words">
              {invoice.customerAddress && <>{invoice.customerAddress}<br /></>}
              {[invoice.customerCity, invoice.customerState, invoice.customerPincode].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="border border-gray-300 p-2 rounded min-w-0 md:min-w-[190px]">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[13px]">
              <span className="font-semibold text-gray-700">Invoice No:</span>
              <span className="text-gray-800 text-right break-all">{invoice.invoiceNumber}</span>
              <span className="font-semibold text-gray-700">Date:</span>
              <span className="text-gray-800 text-right">{invoice.invoiceDate}</span>
              {invoice.dueDate && <>
                <span className="font-semibold text-gray-700">Due Date:</span>
                <span className="text-gray-800 text-right">{invoice.dueDate}</span>
              </>}
              {invoice.enableGst && invoice.gstin && <>
                <span className="font-semibold text-gray-700">GSTIN:</span>
                <span className="text-gray-800 text-right break-all">{invoice.gstin}</span>
              </>}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse mb-2">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left p-1.5 text-[13px] font-semibold w-[5%]">#</th>
              {invoice.enableGst && <th className="text-left p-1.5 text-[13px] font-semibold w-[12%]">HSN</th>}
              <th className="text-left p-1.5 text-[13px] font-semibold">Description</th>
              <th className="text-center p-1.5 text-[13px] font-semibold w-[10%]">Qty</th>
              <th className="text-right p-1.5 text-[13px] font-semibold w-[13%]">Rate</th>
              <th className="text-right p-1.5 text-[13px] font-semibold w-[17%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-1.5 text-gray-700 text-[13px]">{index + 1}</td>
                {invoice.enableGst && <td className="p-1.5 text-gray-600 text-[12px]">{item.hsn || '-'}</td>}
                <td className="p-1.5 text-gray-800 text-[13px]">{item.description || '-'}</td>
                <td className="p-1.5 text-gray-800 text-center text-[13px]">{item.quantity}</td>
                <td className="p-1.5 text-gray-800 text-right text-[13px]">₹{item.rate.toFixed(2)}</td>
                <td className="p-1.5 text-gray-800 text-right font-medium text-[13px]">₹{(item.quantity * item.rate).toFixed(2)}</td>
              </tr>
            ))}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={invoice.enableGst ? 6 : 5} className="p-3 text-center text-gray-400 text-[13px]">No items added</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mb-2">
          <div className="w-full md:w-64">
            <div className="flex justify-between py-1 text-sm">
              <span className="font-semibold text-gray-700">Subtotal:</span>
              <span className="text-gray-800">₹{calcSubtotal().toFixed(2)}</span>
            </div>
            {invoice.enableGst && (
              <>
                <div className="flex justify-between py-0.5 text-[13px] text-gray-600">
                  <span>Taxable Amount:</span>
                  <span>₹{taxable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-[13px] text-gray-600">
                  <span>CGST @ {(gstRate / 2).toFixed(1)}%:</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-[13px] text-gray-600">
                  <span>SGST @ {(gstRate / 2).toFixed(1)}%:</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            {invoice.discount > 0 && (
              <div className="flex justify-between py-1 text-sm">
                <span className="font-semibold text-gray-700">Discount:</span>
                <span className="text-red-600">-₹{invoice.discount.toFixed(2)}</span>
              </div>
            )}
            <hr className="border-t-2 border-gray-900 my-0.5" />
            <div className="flex justify-between py-1 text-base font-bold text-gray-900">
              <span>Grand Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="border border-gray-300 p-2 rounded mb-2 text-sm">
          <span className="font-semibold text-gray-700">Amount in Words: </span>
          <span className="text-gray-800">{numberToWords(grandTotal)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <h3 className="font-bold text-gray-900 mb-0.5 text-sm">Bank Details:</h3>
            <p className="text-gray-700 text-[13px] leading-snug">
              {invoice.bankName && <>Bank: {invoice.bankName}<br /></>}
              {invoice.bankAccount && <>A/c No: {invoice.bankAccount}<br /></>}
              {invoice.bankIfsc && <>IFSC: {invoice.bankIfsc}<br /></>}
              {invoice.bankBranch && <>Branch: {invoice.bankBranch}</>}
              {!invoice.bankName && !invoice.bankAccount && !invoice.bankIfsc && !invoice.bankBranch && 'N/A'}
            </p>
            {invoice.upiId && (
              <p className="text-gray-700 text-[13px] leading-snug mt-1 pt-1 border-t border-gray-200">
                <span className="font-semibold text-green-700">UPI:</span> {invoice.upiId}
                {invoice.upiName && <> ({invoice.upiName})</>}
              </p>
            )}
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-900 mb-0.5 text-sm">Terms &amp; Conditions:</h3>
            <p className="text-gray-700 text-[13px] whitespace-pre-line">{invoice.terms || 'N/A'}</p>
            {invoice.signature && (
              <div className="mt-2 pt-1.5 border-t border-gray-300">
                <p className="font-semibold text-gray-800 text-sm">for {invoice.businessName || 'Your Business'}</p>
                <div className="h-7" />
                <p className="font-semibold text-gray-800 text-sm">({invoice.signature})</p>
                <p className="text-gray-600 text-xs">Authorized Signatory</p>
              </div>
            )}
          </div>
        </div>

        {invoice.upiId && qrDataUrl && (
          <div className="mt-2 pt-2 border-t-2 border-gray-300 flex flex-col sm:flex-row items-center gap-3">
            <div className="bg-white p-1 rounded border border-gray-200 shrink-0">
              <img src={qrDataUrl} alt="UPI QR" className="w-16 h-16" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-gray-900">Pay with UPI</p>
              <p className="text-[13px] text-gray-600">UPI ID: <span className="font-medium text-gray-800">{invoice.upiId}</span></p>
              <p className="text-[13px] text-gray-600">Amount: <span className="font-semibold text-gray-900">₹{grandTotal.toFixed(2)}</span></p>
            </div>
          </div>
        )}
      </div>
      <div className="bg-gray-100 text-center py-1.5 text-gray-500 text-[11px] border-t border-gray-300">
        This is a computer generated invoice
      </div>
    </div>
  )
}

export default InvoicePreview