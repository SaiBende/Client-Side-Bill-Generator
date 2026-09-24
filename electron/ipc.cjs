const { ipcMain, shell, BrowserWindow, dialog } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const db = require('./db.cjs')

function safeName(name) {
  const out = []
  for (const ch of String(name || 'file')) {
    out.push(/[<>:"/\\|?*]/.test(ch) ? '_' : ch)
  }
  return out.join('').trim() || 'file'
}

function broadcastAuth(payload) {
  const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
  if (win) win.webContents.send('billing:auth', payload)
}

function registerIpc() {
  ipcMain.handle('billing:paths', () => db.getPaths())

  ipcMain.handle('billing:db', (_e, op) => db.query(op))

  ipcMain.handle('billing:auth:getSession', (_e, token) => {
    const session = db.authGetSession(token)
    return { data: { session }, error: null }
  })

  ipcMain.handle('billing:auth:signUp', (_e, email, password) => {
    const res = db.authSignUp({ email, password })
    if (res.data?.session) broadcastAuth({ event: 'SIGNED_IN', session: res.data.session })
    return res
  })

  ipcMain.handle('billing:auth:signIn', (_e, email, password) => {
    const res = db.authSignIn({ email, password })
    if (res.data?.session) broadcastAuth({ event: 'SIGNED_IN', session: res.data.session })
    return res
  })

  ipcMain.handle('billing:auth:signOut', (_e, token) => {
    db.authSignOut(token)
    broadcastAuth({ event: 'SIGNED_OUT', session: null })
    return { error: null }
  })

  ipcMain.handle('billing:backup:create', () => db.createBackup())
  ipcMain.handle('billing:backup:list', () => db.listBackups())
  ipcMain.handle('billing:backup:restore', (_e, name) => db.restoreBackup(name))
  ipcMain.handle('billing:backup:delete', (_e, name) => db.deleteBackup(name))
  ipcMain.handle('billing:backup:open', async () => {
    const p = db.getPaths()
    const err = await shell.openPath(p.backupsDir)
    return { error: err ? { message: err } : null }
  })

  ipcMain.handle('files:save', async (_e, { name, dataUrl, ask }) => {
    const buf = Buffer.from(String(dataUrl || '').split(',')[1] || '', 'base64')
    if (!buf.length) return { canceled: false, error: { message: 'Empty file content' }, path: null }
    const safe = safeName(name)
    if (ask) {
      const win = BrowserWindow.getAllWindows()[0]
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Save Invoice',
        defaultPath: path.join(os.homedir(), 'Downloads', safe),
      })
      if (canceled) return { canceled: true, error: null, path: null }
      fs.writeFileSync(filePath, buf)
      return { canceled: false, error: null, path: filePath }
    }
    const p = db.getPaths()
    const exportsDir = path.join(p.root, 'Exports')
    fs.mkdirSync(exportsDir, { recursive: true })
    const filePath = path.join(exportsDir, safe)
    fs.writeFileSync(filePath, buf)
    return { canceled: false, error: null, path: filePath }
  })

  ipcMain.handle('files:reveal', (_e, fp) => {
    if (fp) shell.showItemInFolder(String(fp))
    return { error: null }
  })
}

module.exports = { registerIpc, broadcastAuth }