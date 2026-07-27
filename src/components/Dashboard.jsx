import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, Plus, Trash2, LogOut, IndianRupee, Check, Link } from 'lucide-react'

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function StatusBadge({ status, invoiceId, onUpdate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [])

  const options = ['pending', 'paid', 'cancelled']

  return (
    <div className="relative" ref={ref}>
      <button onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className={`px-2 py-0.5 text-[10px] md:text-xs font-medium rounded-full border-0 outline-none cursor-pointer transition-colors ${statusColors[status] || statusColors.pending} hover:opacity-80`}
      >
        {status || 'pending'}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px] md:min-w-[120px]">
          {options.map(opt => (
            <button key={opt} onClick={e => { e.stopPropagation(); onUpdate(invoiceId, opt); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 md:py-2 text-xs md:text-sm text-left hover:bg-gray-50 transition-colors ${status === opt ? 'font-semibold' : ''}`}
            >
              <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${opt === 'paid' ? 'bg-green-500' : opt === 'cancelled' ? 'bg-red-500' : 'bg-yellow-500'}`} />
              <span className="capitalize">{opt}</span>
              {status === opt && <Check className="w-3 h-3 md:w-3.5 md:h-3.5 ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ user, onSignOut, onNewInvoice, onEditInvoice, onToast, onCopyLink }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    loadInvoices()
  }, [])

  async function loadInvoices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setInvoices(data || [])
    setLoading(false)
  }

  async function deleteInvoice(id) {
    const num = invoices.find(inv => inv.id === id)?.invoice_number
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (!error) {
      setInvoices(prev => prev.filter(inv => inv.id !== id))
      if (onToast) onToast(`Invoice ${num || id} deleted`)
    }
    setDeleteConfirm(null)
  }

  async function updateStatus(id, status) {
    await supabase.from('invoices').update({ status }).eq('id', id)
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv))
  }

  function totalInvoices() {
    return invoices.length
  }

  function totalRevenue() {
    return invoices.reduce((sum, inv) => {
      const items = inv.items || []
      const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.rate || 0), 0)
      return sum + (subtotal - (inv.discount || 0))
    }, 0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 md:gap-2">
            <IndianRupee className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            <h1 className="text-sm md:text-lg font-bold text-gray-800">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-xs md:text-sm text-gray-600 hidden md:inline">{user.email}</span>
            <button onClick={onNewInvoice}
              className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden md:inline">New Invoice</span>
            </button>
            <button onClick={onSignOut}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 md:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-xs md:text-sm text-gray-500">Total Invoices</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{totalInvoices()}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-xs md:text-sm text-gray-500">Total Revenue</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">₹{totalRevenue().toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4">
            <p className="text-xs md:text-sm text-gray-500">Pending / Paid</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{invoices.filter(i => i.status === 'pending').length} / {invoices.filter(i => i.status === 'paid').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm md:text-base font-semibold text-gray-800">Your Invoices</h2>
            <span className="text-xs text-gray-400">{invoices.length} total</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No invoices yet. Create your first one!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <div key={inv.id} onClick={() => onEditInvoice(inv.id)}
                  className="flex items-center justify-between p-3 md:p-4 hover:bg-gray-50 transition-colors cursor-pointer active:bg-gray-100">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                      <span className="text-sm md:text-base font-medium text-gray-900">{inv.invoice_number}</span>
                      <StatusBadge status={inv.status || 'pending'} invoiceId={inv.id} onUpdate={updateStatus} />
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 truncate mt-0.5">
                      {inv.customer_name || 'No customer'} — ₹{(inv.grand_total || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {inv.share_token && (
                      <button onClick={() => onCopyLink && onCopyLink(inv.share_token)}
                        className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Copy Share Link"
                      >
                        <Link className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    )}
                    <button onClick={() => setDeleteConfirm(inv.id)}
                      className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">Delete Invoice</h3>
            <p className="text-sm text-gray-600 mt-2">Are you sure you want to delete this invoice? This action cannot be undone.</p>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >Cancel</button>
              <button onClick={() => deleteInvoice(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
