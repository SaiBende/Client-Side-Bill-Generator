const { app, BrowserWindow, Menu } = require('electron')
const fs = require('fs')
const path = require('path')
const db = require('./db.cjs')
const { registerIpc } = require('./ipc.cjs')

const isDev = !!process.env.VITE_DEV_SERVER_URL
let mainWindow = null
let quitting = false

Menu.setApplicationMenu(null)

app.on('before-quit', () => { quitting = true })

function resolveLogo() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'logo.png'),
    path.join(__dirname, '..', 'public', 'logo.png'),
  ]
  return candidates.find(p => fs.existsSync(p))
}

function createWindow() {
  const logo = resolveLogo()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: 'ShareMyBill',
    ...(logo ? { icon: logo } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  const crashTimes = []
  const reloadAfterCrash = () => {
    if (quitting || !mainWindow || mainWindow.isDestroyed()) return
    const recent = crashTimes.filter(t => Date.now() - t < 30000).length
    if (recent >= 3) return
    crashTimes.push(Date.now())
    mainWindow.webContents.reload()
  }

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.warn('Renderer process gone (' + details.reason + ') - reloading')
    reloadAfterCrash()
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Renderer unresponsive - reloading')
    reloadAfterCrash()
  })
}

app.whenReady().then(async () => {
  await db.initStore()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})