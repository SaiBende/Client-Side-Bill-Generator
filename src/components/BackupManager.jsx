import { useState, useEffect, useCallback } from 'react'
import { X, HardDriveDownload, FolderOpen, RotateCcw, Trash2, Database, Loader2 } from 'lucide-react'

const api = typeof window !== 'undefined' ? window.billingDesktop : null

export default function BackupManager({ open, onClose }) {
  const [paths, setPaths] = useState(null)
  const [backups, setBackups] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!api) return
    const [p, list] = await Promise.all([api.paths(), api.backup.list()])
    setPaths(p)
    setBackups(list.data || [])
  }, [])

  useEffect(() => {
    if (open && api) load()
  }, [open, load])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(t)
  }, [message])

  if (!open) return null

  function flash(msg, ok = true) {
    setMessage({ text: msg, ok })
  }

  async function createBackup() {
    setBusy(true)
    const res = await api.backup.create()
    setBusy(false)
    if (res.error) flash(res.error.message, false)
    else {
      flash(`Backup created: ${res.file}`)
      load()
    }
  }

  async function restore(name) {
    setBusy(true)
    setConfirmRestore(null)
    const res = await api.backup.restore(name)
    setBusy(false)
    if (res.error) flash(res.error.message, false)
    else if (res.data && res.data.autoBackup) {
      flash(`Merged. Current data saved as backup ${res.data.autoBackup} — reloading…`)
      setTimeout(() => window.location.reload(), 1500)
    } else {
      flash('Backup merged successfully.')
      load()
    }
  }

  async function remove(name) {
    setBusy(true)
    await api.backup.del(name)
    setBusy(false)
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Backup & Restore</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {paths && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Data stored on this PC</p>
              <p className="text-xs text-gray-600 break-all font-mono">{paths.root}</p>
              <p className="text-xs text-gray-400 mt-1 break-all font-mono">{paths.dbPath}</p>
              <button onClick={() => api.backup.openFolder()}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" /> Open Backups Folder
              </button>
            </div>
          )}

          <div>
            <button onClick={createBackup} disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />}
              Create Backup Now
            </button>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Saved Backups ({backups.length})</p>
            {backups.length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">No backups yet.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {backups.map(b => (
                  <div key={b.name} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate font-mono">{b.name}</p>
                      <p className="text-xs text-gray-400">{(b.size / 1024).toFixed(1)} KB · {new Date(b.mtime).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setConfirmRestore(b.name)} disabled={busy}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(b.name)} disabled={busy}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && (
            <p className={`text-sm text-center ${message.ok ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
          )}
        </div>
      </div>

      {confirmRestore && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-base font-semibold text-gray-900">Merge Backup</h3>
            <p className="text-sm text-gray-600 mt-2 break-all">
              Add invoices from <span className="font-medium font-mono">{confirmRestore}</span> into your data. Invoices already present keep the newer version. Your current data is saved as a backup first, so nothing is lost.
            </p>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >Cancel</button>
              <button onClick={() => restore(confirmRestore)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >Merge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}