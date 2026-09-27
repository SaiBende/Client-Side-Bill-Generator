// Dev tool: capture a real screenshot of the ShareMyBill app for the landing site.
// Usage: node node_modules/electron/cli.js scripts/capture-shot.cjs
// Requires the local build server (smoke-server.mjs) on :4137 serving dist/, or a deployed URL.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const APP_URL = process.env.CAPTURE_URL || 'http://localhost:4137/app/'
const OUT_DIR = path.join(__dirname, '..', 'landing', 'assets', 'images')

const SAMPLE = {
  businessName: 'Sharma Traders',
  businessAddress: '12, MG Road, Fort Market',
  businessPhone: '+91 98220 12345',
  businessEmail: 'hello@sharmatraders.in',
  customerName: 'Rahul Mehta',
  customerAddress: 'Flat 4B, Green Residency',
  customerCity: 'Pune',
  customerState: 'Maharashtra',
  customerPincode: '411001',
  invoiceNumber: 'INV-2026-084',
  invoiceDate: '2026-09-27',
  dueDate: '2026-10-27',
  discount: 0,
  advance: 0,
  enableGst: true,
  gstin: '27ABCDE1234F1Z5',
  billType: 'normal',
  items: [
    { description: 'Cotton T-Shirts (Printed)', quantity: 25, rate: 499, hsn: '6109', gstRate: 5, areaUnit: 'pcs', measurements: [{ width: '', height: '', unit: 'in', quantity: 1 }] },
    { description: 'Ceramic Coffee Mugs - Custom', quantity: 40, rate: 299, hsn: '6912', gstRate: 12, areaUnit: 'pcs', measurements: [{ width: '', height: '', unit: 'in', quantity: 1 }] },
    { description: 'Acrylic Keychains (Set of 5)', quantity: 60, rate: 149, hsn: '3926', gstRate: 18, areaUnit: 'set', measurements: [{ width: '', height: '', unit: 'in', quantity: 1 }] },
  ],
  bankName: 'HDFC Bank',
  bankAccount: '50100234567890',
  bankIfsc: 'HDFC0001234',
  bankBranch: 'MG Road Branch',
  upiId: 'sharmatraders@okhdfc',
  upiName: 'Sharma Traders',
  terms: 'Payment due within 21 days. Goods once sold will not be taken back.',
  signature: '',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function setUserDataDir() {
  app.setPath('userData', path.join(require('os').tmpdir(), 'sharemybill-capture'))
}

async function shoot(outName) {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  await win.loadURL(APP_URL)
  await sleep(2200)
  await win.webContents.executeJavaScript(
    `localStorage.setItem('billing_draft', ${JSON.stringify(JSON.stringify(SAMPLE))}); 'ok'`
  ).catch(() => 'skip')
  win.webContents.reload()
  await sleep(3200)
  const img = await win.webContents.capturePage()
  const out = path.join(OUT_DIR, outName)
  fs.writeFileSync(out, img.toPNG())
  console.log('saved', out, img.getSize())
  win.destroy()
}

app.whenReady().then(async () => {
  setUserDataDir()
  await shoot('app-editor.png')
  app.quit()
})