import { useRef } from 'react'
import { Plus, Trash2, Building2, User, ClipboardList, Banknote, ScrollText, ImagePlus } from 'lucide-react'
import { measurementItemAmount, formatTotalArea, measurementRows, measurementRowAreaInPricing, areaUnitLabel } from '../lib/measurements'

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

function ResizableLogo({ logo, width, height, onChange, className = '' }) {
  const min = 20
  const startResize = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const origW = width
    const origH = height
    const ratio = origW / origH

    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (mode === 'corner') {
        let newW = origW + dx
        if (newW < min) newW = min
        onChange(Math.round(newW), Math.round(newW / ratio))
      } else if (mode === 'right') {
        onChange(Math.max(min, Math.round(origW + dx)), origH)
      } else {
        onChange(origW, Math.max(min, Math.round(origH + dy)))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleClass = 'absolute w-3 h-3 bg-blue-600 border-2 border-white rounded-[2px] shadow'

  return (
    <div className={`relative inline-block select-none ${className}`}>
      <img src={logo} alt="Business Logo" draggable={false} className="block object-fill"
        style={{ width, height }} />
      <div className="absolute inset-0 border border-blue-400 border-dashed pointer-events-none" />
      <div className={`${handleClass} -right-1 top-1/2 -translate-y-1/2 cursor-ew-resize`}
        style={{ touchAction: 'none' }} onPointerDown={e => startResize(e, 'right')} />
      <div className={`${handleClass} -bottom-1 left-1/2 -translate-x-1/2 cursor-ns-resize`}
        style={{ touchAction: 'none' }} onPointerDown={e => startResize(e, 'bottom')} />
      <div className={`${handleClass} -bottom-1 -right-1 cursor-nwse-resize`}
        style={{ touchAction: 'none' }} onPointerDown={e => startResize(e, 'corner')} />
    </div>
  )
}

function InvoiceForm({ invoice, updateField, updateItem, addItem, removeItem, addItemMeasurement, updateItemMeasurement, removeItemMeasurement, logo, logoSettings, onUploadLogo, onRemoveLogo, onLogoSettingsChange }) {
  const logoInputRef = useRef(null)

  return (
    <div className="space-y-4">
      <Section icon={Building2} title="Business">
        <div className="flex flex-col items-center gap-3 mb-3 pb-3 border-b border-gray-100">
          {logo ? (
            <div className="w-full flex flex-col items-center gap-3">
              <ResizableLogo logo={logo} width={logoSettings?.width || 80} height={logoSettings?.height || 80}
                className="self-start" onChange={(w, h) => onLogoSettingsChange({ width: w, height: h })} />
              <p className="text-[10px] text-gray-400">Drag handles to resize · corner keeps proportion</p>
              <button onClick={onRemoveLogo}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Remove Logo
              </button>
              <div className="w-full bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">Position</span>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {[
                      { key: 'left', label: 'Left' },
                      { key: 'center', label: 'Center' },
                      { key: 'right', label: 'Right' },
                    ].map(opt => (
                      <button key={opt.key} onClick={() => onLogoSettingsChange({ position: opt.key })}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${logoSettings?.position === opt.key ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
<div className="grid grid-cols-2 gap-3 mt-2">
                    <label className="block">
                      <span className="block text-xs font-medium text-gray-600 mb-1">Width (px)</span>
                      <input type="number" min="10" step="1" value={logoSettings?.width || 80}
                        onChange={e => onLogoSettingsChange({ width: Math.max(10, Number(e.target.value) || 10) })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-medium text-gray-600 mb-1">Height (px)</span>
                      <input type="number" min="10" step="1" value={logoSettings?.height || 80}
                        onChange={e => onLogoSettingsChange({ height: Math.max(10, Number(e.target.value) || 10) })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                    </label>
                  </div>
              </div>
            </div>
          ) : (
            <button onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border-2 border-dashed border-blue-200 hover:border-blue-400">
              <ImagePlus className="w-4 h-4" /> Upload Logo
            </button>
          )}
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onUploadLogo(file)
              e.target.value = ''
            }} />
        </div>
        <Field label="Business Name" required>
          <Input value={invoice.businessName} onChange={e => updateField('businessName', e.target.value)} placeholder="Your Business Name" />
        </Field>
        <Field label="Address">
          <textarea value={invoice.businessAddress} onChange={e => updateField('businessAddress', e.target.value)} placeholder="Street, Area, City, State, Pincode"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none" rows="2" />
        </Field>
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
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700">Bill Type</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => updateField('billType', 'normal')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${invoice.billType !== 'measurement' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Normal
            </button>
            <button onClick={() => updateField('billType', 'measurement')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${invoice.billType === 'measurement' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Size / Area
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700">Enable GST</span>
          <button onClick={() => updateField('enableGst', !invoice.enableGst)}
            className={`relative w-10 h-5 rounded-full transition-colors ${invoice.enableGst ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${invoice.enableGst ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {invoice.enableGst && (
          <Field label="GSTIN">
            <Input value={invoice.gstin} onChange={e => updateField('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
          </Field>
        )}
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
            {invoice.enableGst && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Field label="HSN/SAC">
                  <Input value={item.hsn || ''} onChange={e => updateItem(index, 'hsn', e.target.value)} placeholder="HSN Code" />
                </Field>
                <Field label="GST Rate">
                  <select value={item.gstRate || 0} onChange={e => updateItem(index, 'gstRate', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </Field>
              </div>
            )}
{invoice.billType === 'measurement' ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Field label="Rate">
                      <Input value={item.rate} onChange={e => updateItem(index, 'rate', Number(e.target.value))} type="number" min="0" />
                    </Field>
                    <Field label="Price Unit">
                      <select value={item.areaUnit || 'sqft'} onChange={e => updateItem(index, 'areaUnit', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        <option value="sqft">Per sq ft</option>
                        <option value="sqin">Per sq inch</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-2 space-y-2">
                    {measurementRows(item).map((m, mIndex) => (
                      <div key={mIndex} className="bg-white border border-gray-200 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-gray-500">Size #{mIndex + 1}</span>
                          {measurementRows(item).length > 1 && (
                            <button onClick={() => removeItemMeasurement(index, mIndex)}
                              className="text-red-500 hover:text-red-700 p-0.5">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Width">
                            <Input value={m.width ?? ''} onChange={e => updateItemMeasurement(index, mIndex, 'width', e.target.value)} placeholder="Width" type="number" min="0" />
                          </Field>
                          <Field label="Height">
                            <Input value={m.height ?? ''} onChange={e => updateItemMeasurement(index, mIndex, 'height', e.target.value)} placeholder="Height" type="number" min="0" />
                          </Field>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          <Field label="Unit">
                            <select value={m.unit || 'in'} onChange={e => updateItemMeasurement(index, mIndex, 'unit', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                              <option value="in">in</option>
                              <option value="ft">ft</option>
                            </select>
                          </Field>
                          <Field label="Qty">
                            <Input value={m.quantity} onChange={e => updateItemMeasurement(index, mIndex, 'quantity', Number(e.target.value))} type="number" min="1" />
                          </Field>
                          <div className="col-span-2">
                            <Field label="Area">
                              <div className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                                {measurementRowAreaInPricing(m, item.areaUnit).toFixed(2)} {areaUnitLabel(item.areaUnit)}
                              </div>
                            </Field>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addItemMeasurement(index)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-200 hover:border-blue-400 mt-2">
                    <Plus className="w-3.5 h-3.5" /> Add Size
                  </button>
                  <div className="flex items-center justify-between text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 mt-2">
                    <div>
                      <span className="text-gray-600">Sizes: <span className="font-medium text-gray-800">{measurementRows(item).length}</span></span>
                      <span className="text-gray-400 mx-2">|</span>
                      <span className="text-gray-600">Total Area: <span className="font-medium text-gray-800">{formatTotalArea(item)}</span></span>
                    </div>
                    <span className="text-gray-800 font-medium">₹{measurementItemAmount(item).toFixed(2)}</span>
                  </div>
                </>
              ) : (
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
            )}
          </div>
        ))}
        <button onClick={addItem}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors w-full justify-center border-2 border-dashed border-blue-200 hover:border-blue-400">
          <Plus className="w-4 h-4" /> Add Item
        </button>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Subtotal:</span>
            <span className="text-gray-800">₹{invoice.items.reduce((s, i) => s + (invoice.billType === 'measurement' ? measurementItemAmount(i) : i.quantity * i.rate), 0).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <label className="font-medium text-gray-700">Discount (₹):</label>
            <input type="number" min="0" value={invoice.discount} onChange={e => updateField('discount', Number(e.target.value))}
              className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right" />
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <label className="font-medium text-gray-700">Advance Paid (₹):</label>
            <input type="number" min="0" value={invoice.advance ?? 0} onChange={e => updateField('advance', Number(e.target.value))}
              className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right" />
          </div>
          <hr className="border-t border-gray-300 my-1.5" />
          <div className="flex items-center justify-between text-sm font-bold text-gray-900">
            <span>Grand Total:</span>
            <span>₹{(invoice.items.reduce((s, i) => s + (invoice.billType === 'measurement' ? measurementItemAmount(i) : i.quantity * i.rate), 0) - invoice.discount).toFixed(2)}</span>
          </div>
          {(invoice.advance || 0) > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="font-medium text-gray-700">Balance Due:</span>
              <span className="font-bold text-gray-900">₹{(invoice.items.reduce((s, i) => s + (invoice.billType === 'measurement' ? measurementItemAmount(i) : i.quantity * i.rate), 0) - invoice.discount - (invoice.advance || 0)).toFixed(2)}</span>
            </div>
          )}
        </div>
      </Section>

      <Section icon={Banknote} title="Payment Details">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">🏦 Bank Transfer</h3>
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
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-green-800 mb-2">📱 UPI Payment</h3>
          <Field label="UPI ID">
            <Input value={invoice.upiId} onChange={e => updateField('upiId', e.target.value)} placeholder="example@paytm / example@upi" />
          </Field>
          <Field label="UPI Payee Name">
            <Input value={invoice.upiName} onChange={e => updateField('upiName', e.target.value)} placeholder="Name on UPI" />
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
