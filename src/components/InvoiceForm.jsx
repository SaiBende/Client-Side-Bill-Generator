import { Plus, Trash2, Building2, User, ClipboardList, Banknote, ScrollText } from 'lucide-react'

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <Icon className="w-5 h-5 text-blue-600" />
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${className}`} />
  )
}

function InvoiceForm({ invoice, updateField, updateItem, addItem, removeItem }) {
  return (
    <div className="space-y-4">
      <Section icon={Building2} title="Business">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h3 className="font-bold text-gray-900 text-sm">Shri Raj Garware Hitech Films and Decors</h3>
          <p className="text-gray-600 text-sm mt-1">Opp. Ayurvedic College, Vazirabad, Nanded - 431605</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={invoice.businessPhone} onChange={e => updateField('businessPhone', e.target.value)} placeholder="Phone Number" />
          </Field>
          <Field label="Email">
            <Input value={invoice.businessEmail} onChange={e => updateField('businessEmail', e.target.value)} placeholder="Email" type="email" />
          </Field>
        </div>
      </Section>

      <Section icon={User} title="Customer Details">
        <Field label="Customer Name" required>
          <Input value={invoice.customerName} onChange={e => updateField('customerName', e.target.value)} placeholder="Customer / Party Name" />
        </Field>
        <Field label="Address">
          <textarea value={invoice.customerAddress} onChange={e => updateField('customerAddress', e.target.value)} placeholder="Street, Area, Landmark"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none" rows="2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <Input value={invoice.customerCity} onChange={e => updateField('customerCity', e.target.value)} placeholder="City" />
          </Field>
          <Field label="State">
            <Input value={invoice.customerState} onChange={e => updateField('customerState', e.target.value)} placeholder="State" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pincode">
            <Input value={invoice.customerPincode} onChange={e => updateField('customerPincode', e.target.value)} placeholder="Pincode" />
          </Field>
        </div>
      </Section>

      <Section icon={ClipboardList} title="Invoice Details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice No." required>
            <Input value={invoice.invoiceNumber} onChange={e => updateField('invoiceNumber', e.target.value)} placeholder="INV-0001" />
          </Field>
          <Field label="Date" required>
            <Input value={invoice.invoiceDate} onChange={e => updateField('invoiceDate', e.target.value)} type="date" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due Date">
            <Input value={invoice.dueDate} onChange={e => updateField('dueDate', e.target.value)} type="date" />
          </Field>
        </div>
      </Section>

      <Section icon={ScrollText} title="Items">
        {invoice.items.map((item, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">Item #{index + 1}</span>
              {invoice.items.length > 1 && (
                <button onClick={() => removeItem(index)}
                  className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <Field label="Description">
              <input value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Item description"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" />
            </Field>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              <Field label="Qty">
                <Input value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} type="number" min="1" />
              </Field>
              <Field label="Rate">
                <Input value={item.rate} onChange={e => updateItem(index, 'rate', Number(e.target.value))} type="number" min="0" />
              </Field>
              <Field label="Amount">
                <div className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                  ₹{(item.quantity * item.rate).toFixed(2)}
                </div>
              </Field>
            </div>
          </div>
        ))}
        <button onClick={addItem}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors w-full justify-center border-2 border-dashed border-blue-200 hover:border-blue-400">
          <Plus className="w-4 h-4" /> Add Item
        </button>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Subtotal:</span>
            <span className="text-gray-800">₹{invoice.items.reduce((s, i) => s + i.quantity * i.rate, 0).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <label className="font-medium text-gray-700">Discount (₹):</label>
            <input type="number" min="0" value={invoice.discount} onChange={e => updateField('discount', Number(e.target.value))}
              className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right" />
          </div>
          <hr className="border-t border-gray-300 my-1.5" />
          <div className="flex items-center justify-between text-sm font-bold text-gray-900">
            <span>Grand Total:</span>
            <span>₹{(invoice.items.reduce((s, i) => s + i.quantity * i.rate, 0) - invoice.discount).toFixed(2)}</span>
          </div>
        </div>
      </Section>

      <Section icon={Banknote} title="Bank Details">
        <Field label="Bank Name">
          <Input value={invoice.bankName} onChange={e => updateField('bankName', e.target.value)} placeholder="Bank Name" />
        </Field>
        <Field label="Account Number">
          <Input value={invoice.bankAccount} onChange={e => updateField('bankAccount', e.target.value)} placeholder="Account Number" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="IFSC Code">
            <Input value={invoice.bankIfsc} onChange={e => updateField('bankIfsc', e.target.value)} placeholder="IFSC0012345" />
          </Field>
          <Field label="Branch">
            <Input value={invoice.bankBranch} onChange={e => updateField('bankBranch', e.target.value)} placeholder="Branch Name" />
          </Field>
        </div>
      </Section>

      <Section icon={ScrollText} title="Terms & Signature">
        <Field label="Terms & Conditions">
          <textarea value={invoice.terms} onChange={e => updateField('terms', e.target.value)} placeholder="Terms and conditions"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none" rows="3" />
        </Field>
        <Field label="Signature / Authorized By">
          <Input value={invoice.signature} onChange={e => updateField('signature', e.target.value)} placeholder="Authorized Signatory Name" />
        </Field>
      </Section>
    </div>
  )
}

export default InvoiceForm
