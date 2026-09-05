export default function BlankInvoicePreview({ businessName, businessAddress, businessPhone, businessEmail, logo, logoSettings }) {
  const rows = Array.from({ length: 5 }, (_, i) => i)
  const style = logoSettings || { position: 'center', width: 80, height: 80 }

  return (
    <div className="bg-white border border-gray-300 text-[10px]">
      <div className="p-4">
        <div className="text-center mb-2">
          {logo && (
            <div className={`flex mb-2 ${style.position === 'left' ? 'justify-start' : style.position === 'right' ? 'justify-end' : 'justify-center'}`}>
              <img src={logo} alt="Business Logo" className="object-contain" style={{ width: style.width, height: style.height }} />
            </div>
          )}
          <h2 className="text-base font-bold text-gray-900 uppercase break-words">{businessName || 'Your Business Name'}</h2>
          <p className="text-gray-600 whitespace-pre">{businessAddress || 'Your Address'}</p>
          <div className="text-gray-600">
            {businessPhone && <>Phone: {businessPhone}<br /></>}
            {businessEmail && <>Email: {businessEmail}</>}
          </div>
        </div>

        <hr className="border-t-2 border-gray-900 my-2" />

        <div className="flex flex-col md:flex-row justify-between gap-2 mb-2">
          <div className="border border-gray-300 p-2 rounded flex-1 min-h-[60px]">
            <h3 className="font-bold text-gray-900 mb-1 text-[11px]">Bill To:</h3>
            <div className="space-y-1.5">
              <div className="border-b border-dotted border-gray-400 h-4" />
              <div className="border-b border-dotted border-gray-400 h-4" />
              <div className="border-b border-dotted border-gray-400 h-4" />
            </div>
          </div>
          <div className="border border-gray-300 p-2 rounded min-w-0 md:min-w-[170px]">
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <span className="font-semibold text-gray-700">Invoice No:</span>
              <span className="border-b border-dotted border-gray-400 h-3" />
              <span className="font-semibold text-gray-700">Date:</span>
              <span className="border-b border-dotted border-gray-400 h-3" />
              <span className="font-semibold text-gray-700">Due Date:</span>
              <span className="border-b border-dotted border-gray-400 h-3" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-collapse mb-2">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left p-1.5 text-[10px] font-semibold w-[5%]">#</th>
              <th className="text-left p-1.5 text-[10px] font-semibold w-[55%]">Description</th>
              <th className="text-center p-1.5 text-[10px] font-semibold w-[10%]">Qty</th>
              <th className="text-right p-1.5 text-[10px] font-semibold w-[13%]">Rate</th>
              <th className="text-right p-1.5 text-[10px] font-semibold w-[17%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-1.5 text-gray-400 align-top">{i + 1}</td>
                <td className="p-1.5 align-top"><div className="border-b border-dotted border-gray-300 h-5" /></td>
                <td className="p-1.5 align-top"><div className="border-b border-dotted border-gray-300 h-5 w-8 mx-auto" /></td>
                <td className="p-1.5 align-top"><div className="border-b border-dotted border-gray-300 h-5 w-12 ml-auto" /></td>
                <td className="p-1.5 align-top"><div className="border-b border-dotted border-gray-300 h-5 w-14 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex justify-end mb-2">
          <div className="w-full md:w-60">
            <div className="flex justify-between py-1 text-[11px]">
              <span className="font-semibold text-gray-700">Subtotal:</span>
              <div className="border-b border-dotted border-gray-400 h-3 w-20" />
            </div>
            <div className="flex justify-between py-1 text-[11px]">
              <span className="font-semibold text-gray-700">Discount:</span>
              <div className="border-b border-dotted border-gray-400 h-3 w-20" />
            </div>
            <hr className="border-t-2 border-gray-900 my-1" />
            <div className="flex justify-between py-1 text-sm font-bold text-gray-900">
              <span>Grand Total:</span>
              <div className="border-b-2 border-dotted border-gray-500 h-4 w-20" />
            </div>
          </div>
        </div>

        <div className="border border-gray-300 p-2 rounded mb-2">
          <span className="font-semibold text-gray-700 text-[11px]">Amount in Words: </span>
          <span className="border-b border-dotted border-gray-400 inline-block min-w-[250px] h-3" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <h3 className="font-bold text-gray-900 mb-1 text-[11px]">Bank Details:</h3>
            <div className="space-y-1.5">
              <div className="border-b border-dotted border-gray-400 h-3 w-44" />
              <div className="border-b border-dotted border-gray-400 h-3 w-44" />
              <div className="border-b border-dotted border-gray-400 h-3 w-28" />
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-900 mb-1 text-[11px]">Terms & Conditions:</h3>
            <div className="space-y-1">
              <div className="border-b border-dotted border-gray-400 h-3 w-full" />
              <div className="border-b border-dotted border-gray-400 h-3 w-3/4 ml-auto" />
            </div>
            <div className="mt-3 pt-1.5 border-t border-gray-300">
              <p className="font-semibold text-gray-800 text-[11px]">for {businessName || 'Your Business Name'}</p>
              <div className="h-8" />
              <div className="border-b border-dotted border-gray-400 h-3 w-28 ml-auto" />
              <p className="text-gray-600 text-[10px] mt-0.5">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-100 text-center py-1.5 text-gray-500 text-[9px] border-t border-gray-300">
        This is a computer generated invoice
      </div>
    </div>
  )
}
