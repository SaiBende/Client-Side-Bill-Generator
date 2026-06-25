export default function BlankInvoicePreview({ businessPhone, businessEmail }) {
  const rows = Array.from({ length: 6 }, (_, i) => i)

  return (
    <div className="bg-white border border-gray-300 text-xs">
      <div className="p-6">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 uppercase">Shri Raj Garware Hitech Films and Decors</h2>
          <p className="text-gray-600 mt-1 whitespace-pre">Opp. Ayurvedic College, Vazirabad, Nanded - 431605</p>
          <div className="mt-1 text-gray-600">
            {businessPhone && <>Phone: {businessPhone}<br /></>}
            {businessEmail && <>Email: {businessEmail}</>}
          </div>
        </div>

        <hr className="border-t-2 border-gray-900 my-3" />

        <div className="flex justify-between gap-4 mb-4">
          <div className="border border-gray-300 p-3 rounded flex-1 min-h-[80px]">
            <h3 className="font-bold text-gray-900 mb-1 text-sm">Bill To:</h3>
            <div className="space-y-2">
              <div className="border-b border-dotted border-gray-400 h-5" />
              <div className="border-b border-dotted border-gray-400 h-5" />
              <div className="border-b border-dotted border-gray-400 h-5" />
            </div>
          </div>
          <div className="border border-gray-300 p-3 rounded min-w-[180px]">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <span className="font-semibold text-gray-700">Invoice No:</span>
              <span className="border-b border-dotted border-gray-400 h-4" />
              <span className="font-semibold text-gray-700">Date:</span>
              <span className="border-b border-dotted border-gray-400 h-4" />
              <span className="font-semibold text-gray-700">Due Date:</span>
              <span className="border-b border-dotted border-gray-400 h-4" />
            </div>
          </div>
        </div>

        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left p-2 text-xs font-semibold w-[5%]">#</th>
              <th className="text-left p-2 text-xs font-semibold w-[55%]">Description</th>
              <th className="text-center p-2 text-xs font-semibold w-[10%]">Qty</th>
              <th className="text-right p-2 text-xs font-semibold w-[13%]">Rate</th>
              <th className="text-right p-2 text-xs font-semibold w-[17%]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2 text-gray-400 align-top">{i + 1}</td>
                <td className="p-2 align-top"><div className="border-b border-dotted border-gray-300 h-6" /></td>
                <td className="p-2 align-top"><div className="border-b border-dotted border-gray-300 h-6 w-8 mx-auto" /></td>
                <td className="p-2 align-top"><div className="border-b border-dotted border-gray-300 h-6 w-14 ml-auto" /></td>
                <td className="p-2 align-top"><div className="border-b border-dotted border-gray-300 h-6 w-16 ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-4">
          <div className="w-64">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="font-semibold text-gray-700">Subtotal:</span>
              <div className="border-b border-dotted border-gray-400 h-4 w-24" />
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="font-semibold text-gray-700">Discount:</span>
              <div className="border-b border-dotted border-gray-400 h-4 w-24" />
            </div>
            <hr className="border-t-2 border-gray-900 my-1" />
            <div className="flex justify-between py-1.5 text-base font-bold text-gray-900">
              <span>Grand Total:</span>
              <div className="border-b-2 border-dotted border-gray-500 h-5 w-24" />
            </div>
          </div>
        </div>

        <div className="border border-gray-300 p-3 rounded mb-4">
          <span className="font-semibold text-gray-700">Amount in Words: </span>
          <span className="border-b border-dotted border-gray-400 inline-block min-w-[300px] h-4" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-1 text-sm">Bank Details:</h3>
            <div className="space-y-2">
              <div className="border-b border-dotted border-gray-400 h-4 w-48" />
              <div className="border-b border-dotted border-gray-400 h-4 w-48" />
              <div className="border-b border-dotted border-gray-400 h-4 w-32" />
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-gray-900 mb-1 text-sm">Terms & Conditions:</h3>
            <div className="space-y-1.5">
              <div className="border-b border-dotted border-gray-400 h-4 w-full" />
              <div className="border-b border-dotted border-gray-400 h-4 w-3/4 ml-auto" />
            </div>
            <div className="mt-6 pt-2 border-t border-gray-300">
              <p className="font-semibold text-gray-800">for Shri Raj Garware Hitech Films and Decors</p>
              <div className="h-12" />
              <div className="border-b border-dotted border-gray-400 h-4 w-32 ml-auto" />
              <p className="text-gray-600 text-xs mt-1">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-100 text-center py-2 text-gray-500 text-[10px] border-t border-gray-300">
        This is a computer generated invoice
      </div>
    </div>
  )
}
