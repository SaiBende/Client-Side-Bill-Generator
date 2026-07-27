import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function InvoicePreview({ invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst, numberToWords }) {
  const grandTotal = calcGrandTotal()
  const taxable = calcSubtotal()
  const cgst = calcCgst ? calcCgst() : 0
  const sgst = calcSgst ? calcSgst() : 0
  const gstRate = Math.max(...(invoice.items || []).map(i => i.gstRate || 0))
  const [qrDataUrl, setQrDataUrl] = useState(null)

  useEffect(() => {
    if (!invoice.upiId) { setQrDataUrl(null); return }
    const upiLink = `upi://pay?pa=${encodeURIComponent(invoice.upiId)}&pn=${encodeURIComponent(invoice.upiName || invoice.businessName || 'Business')}&am=${grandTotal.toFixed(2)}&tn=${encodeURIComponent(invoice.invoiceNumber || 'Invoice')}&cu=INR`
    QRCode.toDataURL(upiLink, { width: 200, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } }).then(setQrDataUrl)
  }, [invoice.upiId, invoice.upiName, invoice.businessName, grandTotal, invoice.invoiceNumber])

  return (
    <div className="bg-white shadow-lg border border-gray-300 rounded-lg overflow-hidden text-xs">
      <div className="p-6">
        <div className="text-center mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 uppercase break-words">{invoice.businessName || 'Your Business Name'}</h2>
          <p className="text-gray-600 mt-1 leading-relaxed whitespace-pre" style={{ wordSpacing: '2px' }}>{invoice.businessAddress || 'Your Address'}</p>
          <div className="mt-1 text-gray-600">
            {invoice.businessPhone && <>Phone: {invoice.businessPhone}<br /></>}
            {invoice.businessEmail && <>Email: {invoice.businessEmail}</>}
          </div>
        </div>

        <hr className="border-t-2 border-gray-900 my-3" />

        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
          <div className="border border-gray-300 p-3 rounded flex-1">
            <h3 className="font-bold text-gray-900 mb-1 text-sm">Bill To:</h3>
            <p className="font-semibold text-gray-800 break-words">{invoice.customerName || 'Customer Name'}</p>
            <p className="text-gray-600 break-words">
              {invoice.customerAddress && <>{invoice.customerAddress}<br /></>}
              {[invoice.customerCity, invoice.customerState, invoice.customerPincode].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="border border-gray-300 p-3 rounded min-w-0 md:min-w-[180px]">
            <div className="grid grid-cols-2 gap-x-2 md:gap-x-3 gap-y-1">
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
                <span className="text-gray-800 text-right text-[10px] break-all">{invoice.gstin}</span>
              </>}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left p-2 text-xs font-semibold w-[5%]">#</th>
              {invoice.enableGst && <th className="text-left p-2 text-xs font-semibold w-[12%]">HSN</th>}
              <th className="text-left p-2 text-xs font-semibold">Description</th>
              <th className="text-center p-2 text-xs font-semibold w-[10%]">Qty</th>
              <th className="text-right p-2 text-xs font-semibold w-[13%]">Rate</th>
              <th className="text-right p-2 text-xs font-semibold w-[17%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-2 text-gray-700">{index + 1}</td>
                {invoice.enableGst && <td className="p-2 text-gray-600 text-[10px]">{item.hsn || '-'}</td>}
                <td className="p-2 text-gray-800">{item.description || '-'}</td>
                <td className="p-2 text-gray-800 text-center">{item.quantity}</td>
                <td className="p-2 text-gray-800 text-right">₹{item.rate.toFixed(2)}</td>
                <td className="p-2 text-gray-800 text-right font-medium">₹{(item.quantity * item.rate).toFixed(2)}</td>
              </tr>
            ))}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={invoice.enableGst ? 6 : 5} className="p-4 text-center text-gray-400">No items added</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <div className="flex justify-end mb-4">
          <div className="w-full md:w-64">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="font-semibold text-gray-700">Subtotal:</span>
              <span className="text-gray-800">₹{calcSubtotal().toFixed(2)}</span>
            </div>
            {invoice.enableGst && (
              <>
                <div className="flex justify-between py-1 text-sm text-gray-600">
                  <span>Taxable Amount:</span>
                  <span>₹{taxable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm text-gray-600">
                  <span>CGST @ {(gstRate / 2).toFixed(1)}%:</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm text-gray-600">
                  <span>SGST @ {(gstRate / 2).toFixed(1)}%:</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            {invoice.discount > 0 && (
              <div className="flex justify-between py-1.5 text-sm">
                <span className="font-semibold text-gray-700">Discount:</span>
                <span className="text-red-600">-₹{invoice.discount.toFixed(2)}</span>
              </div>
            )}
            <hr className="border-t-2 border-gray-900 my-1" />
            <div className="flex justify-between py-1.5 text-base font-bold text-gray-900">
              <span>Grand Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="border border-gray-300 p-3 rounded mb-4">
          <span className="font-semibold text-gray-700">Amount in Words: </span>
          <span className="text-gray-800">{numberToWords(grandTotal)}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-1 text-sm">Bank Details:</h3>
            <p className="text-gray-700 leading-relaxed">
              {invoice.bankName && <>Bank: {invoice.bankName}<br /></>}
              {invoice.bankAccount && <>A/c No: {invoice.bankAccount}<br /></>}
              {invoice.bankIfsc && <>IFSC: {invoice.bankIfsc}<br /></>}
              {invoice.bankBranch && <>Branch: {invoice.bankBranch}</>}
              {!invoice.bankName && !invoice.bankAccount && !invoice.bankIfsc && !invoice.bankBranch && 'N/A'}
            </p>
            {invoice.upiId && (
              <p className="text-gray-700 leading-relaxed mt-2 pt-2 border-t border-gray-200">
                <span className="font-semibold text-green-700">UPI:</span> {invoice.upiId}
                {invoice.upiName && <> ({invoice.upiName})</>}
              </p>
            )}
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-900 mb-1 text-sm">Terms & Conditions:</h3>
            <p className="text-gray-700 text-xs whitespace-pre-line">{invoice.terms || 'N/A'}</p>
            {invoice.signature && (
              <div className="mt-4 pt-2 border-t border-gray-300">
                <p className="font-semibold text-gray-800">for {invoice.businessName || 'Your Business'}</p>
                <div className="h-10" />
                <p className="font-semibold text-gray-800">({invoice.signature})</p>
                <p className="text-gray-600 text-xs">Authorized Signatory</p>
              </div>
            )}
          </div>
        </div>
        {invoice.upiId && qrDataUrl && (
          <div className="mt-4 pt-4 border-t-2 border-gray-300 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2 rounded-lg border border-gray-200 shrink-0">
              <img src={qrDataUrl} alt="UPI QR" className="w-28 h-28" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-gray-900">Pay with UPI</p>
              <p className="text-xs text-gray-600 mt-0.5">UPI ID: <span className="font-medium text-gray-800">{invoice.upiId}</span></p>
              <p className="text-xs text-gray-600">Amount: <span className="font-semibold text-gray-900">₹{grandTotal.toFixed(2)}</span></p>
              <p className="text-[9px] text-gray-400 mt-1">Scan QR to pay</p>
            </div>
          </div>
        )}
      </div>
      <div className="bg-gray-100 text-center py-2 text-gray-500 text-[10px] border-t border-gray-300">
        This is a computer generated invoice
      </div>
    </div>
  )
}

export default InvoicePreview
