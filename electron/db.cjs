const path = require('path')
const os = require('os')
const fs = require('fs')
const crypto = require('crypto')
const initSqlJs = require('sql.js')

const INVOICE_COLS = [
  'user_id', 'business_name', 'business_address', 'business_phone', 'business_email',
  'customer_name', 'customer_address', 'customer_city', 'customer_state', 'customer_pincode',
  'invoice_number', 'invoice_date', 'due_date', 'discount', 'advance', 'enable_gst', 'gstin',
  'bill_type', 'items', 'grand_total', 'bank_name', 'bank_account', 'bank_ifsc', 'bank_branch',
  'upi_id', 'upi_name', 'terms', 'signature', 'share_token', 'status',
]

const PROFILE_COLS = [
  'user_id', 'business_name', 'business_address', 'business_phone', 'business_email',
  'bank_name', 'bank_account', 'bank_ifsc', 'bank_branch', 'upi_id', 'upi_name', 'gstin',
]

const NUMERIC_COLS = ['discount', 'advance', 'grand_total']
const BOOL_COLS = ['enable_gst']
const JSON_COLS = ['items']

const BACKUP_KEEP = 10

let db = null
let SQL = null
let dbPath = null
let backupsDir = null

function rootPaths() {
  const home = os.homedir()
  const docs = process.env.BILLING_FOLDER ? path.resolve(process.env.BILLING_FOLDER) : path.join(home, 'Documents', 'BillingApp')
  return {
    root: docs,
    dbPath: path.join(docs, 'billing.db'),
    backupsDir: path.join(docs, 'Backups'),
  }
}

function ensureDirs() {
  const p = rootPaths()
  fs.mkdirSync(path.dirname(p.dbPath), { recursive: true })
  fs.mkdirSync(p.backupsDir, { recursive: true })
  return p
}

function migrate() {
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      business_name TEXT DEFAULT '',
      business_address TEXT DEFAULT '',
      business_phone TEXT DEFAULT '',
      business_email TEXT DEFAULT '',
      customer_name TEXT DEFAULT '',
      customer_address TEXT DEFAULT '',
      customer_city TEXT DEFAULT '',
      customer_state TEXT DEFAULT '',
      customer_pincode TEXT DEFAULT '',
      invoice_number TEXT DEFAULT '',
      invoice_date TEXT DEFAULT '',
      due_date TEXT,
      discount REAL DEFAULT 0,
      advance REAL DEFAULT 0,
      enable_gst INTEGER DEFAULT 0,
      gstin TEXT DEFAULT '',
      bill_type TEXT DEFAULT 'normal',
      items TEXT DEFAULT '[]',
      grand_total REAL DEFAULT 0,
      bank_name TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      bank_ifsc TEXT DEFAULT '',
      bank_branch TEXT DEFAULT '',
      upi_id TEXT DEFAULT '',
      upi_name TEXT DEFAULT '',
      terms TEXT DEFAULT '',
      signature TEXT DEFAULT '',
      share_token TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      business_name TEXT DEFAULT '',
      business_address TEXT DEFAULT '',
      business_phone TEXT DEFAULT '',
      business_email TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      bank_ifsc TEXT DEFAULT '',
      bank_branch TEXT DEFAULT '',
      upi_id TEXT DEFAULT '',
      upi_name TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT DEFAULT '',
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_user_updated ON invoices(user_id, updated_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON invoices(user_id, created_at)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`)
  db.exec(`INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', '1')`)
}

function persistNow() {
  if (!db) return
  const data = Buffer.from(db.export())
  const tmp = dbPath + '.tmp'
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, dbPath)
}

async function initStore() {
  const p = ensureDirs()
  dbPath = p.dbPath
  backupsDir = p.backupsDir
  SQL = SQL || (await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') }))
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath))
  } else {
    db = new SQL.Database()
  }
  migrate()
  persistNow()
  return p
}

function queryAll(sql, params) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params || [])
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

function normalizePayload(table, data) {
  const allowed = table === 'user_profiles' ? PROFILE_COLS : INVOICE_COLS
  const clean = {}
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (!allowed.includes(key)) continue
      if (NUMERIC_COLS.includes(key)) {
        clean[key] = Number(data[key]) || 0
      } else if (BOOL_COLS.includes(key)) {
        clean[key] = data[key] ? 1 : 0
      } else if (JSON_COLS.includes(key)) {
        clean[key] = JSON.stringify(data[key] || [])
      } else {
        clean[key] = data[key] == null ? null : String(data[key])
      }
    }
  }
  return clean
}

function mapRow(row, table) {
  const out = { ...row }
  for (const col of BOOL_COLS) if (col in out) out[col] = !!out[col]
  for (const col of JSON_COLS) {
    if (col in out) {
      try {
        out[col] = JSON.parse(out[col] || '[]')
      } catch {
        out[col] = []
      }
    }
  }
  if (table === 'user_profiles') out.user_profiles = null
  return out
}

function whereClause(filters) {
  if (!filters || !filters.length) return { sql: '', params: [] }
  const sql = ' WHERE ' + filters.map(f => `"${f.col}" = ?`).join(' AND ')
  return { sql, params: filters.map(f => f.val) }
}

function runSelect(op) {
  const table = op.table
  const w = whereClause(op.filters)
  let sql = `SELECT * FROM "${table}"` + w.sql
  if (op.order) {
    const dir = op.order.ascending === false ? ' DESC' : ' ASC'
    sql += ` ORDER BY "${op.order.col}"${dir}`
  }
  const params = [...w.params]
  if (op.limit) {
    sql += ' LIMIT ?'
    params.push(Number(op.limit))
  }
  const rows = queryAll(sql, params)
  return rows.map(r => mapRow(r, table))
}

function runInsert(op) {
  const table = op.table
  const payload = normalizePayload(table, op.data)
  if (table === 'invoices' && !payload.id) payload.id = crypto.randomUUID()
  const now = new Date().toISOString()
  if (table === 'invoices' && !payload.created_at) payload.created_at = now
  payload.updated_at = now
  const cols = Object.keys(payload)
  const setCols = payload.id ? ['id', ...cols.filter(c => c !== 'id')] : cols
  const marks = setCols.map(() => '?').join(', ')
  const values = setCols.map(c => payload[c])
  db.run(`INSERT INTO "${table}" (${setCols.join(', ')}) VALUES (${marks})`, values)
  persistNow()
  return { id: payload.id, share_token: payload.share_token ?? null, created_at: payload.created_at }
}

function runUpdate(op) {
  const table = op.table
  const payload = normalizePayload(table, op.data)
  delete payload.id
  const now = new Date().toISOString()
  payload.updated_at = now
  const cols = Object.keys(payload)
  if (!cols.length) return
  const setSql = cols.map(c => `"${c}" = ?`).join(', ')
  const w = whereClause(op.filters)
  const params = [...cols.map(c => payload[c]), ...w.params]
  db.run(`UPDATE "${table}" SET ${setSql}` + w.sql, params)
  persistNow()
}

function runUpsert(op) {
  const conflict = op.conflict || 'id'
  const table = op.table
  const w = whereClause([{ col: conflict, val: op.data ? op.data[conflict] : undefined }])
  const existing = queryAll(`SELECT * FROM "${table}"` + w.sql, w.params)
  if (existing.length) {
    runUpdate({ ...op, filters: [{ col: conflict, val: op.data[conflict] }] })
  } else {
    runInsert(op)
  }
}

function runDelete(op) {
  const table = op.table
  const w = whereClause(op.filters)
  db.run(`DELETE FROM "${table}"` + w.sql, w.params)
  persistNow()
}

function query(op) {
  try {
    switch (op.op) {
      case 'select':
        return { error: null, data: runSelect(op) }
      case 'insert':
        return { error: null, data: runInsert(op) }
      case 'update':
        runUpdate(op)
        return { error: null, data: null }
      case 'upsert':
        runUpsert(op)
        return { error: null, data: null }
      case 'delete':
        runDelete(op)
        return { error: null, data: null }
      default:
        return { error: { message: `Unknown db op: ${op.op}` }, data: null }
    }
  } catch (e) {
    return { error: { message: e.message || String(e) }, data: null }
  }
}

function makeSession(token, id, email) {
  return {
    access_token: token,
    token_type: 'bearer',
    user: { id, email, created_at: new Date().toISOString(), user_metadata: {} },
  }
}

function authSignUp({ email, password }) {
  const em = String(email || '').trim().toLowerCase()
  if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return { data: null, error: { message: 'Invalid email address' } }
  if (!password || String(password).length < 6) return { data: null, error: { message: 'Password must be at least 6 characters' } }
  const existing = queryAll('SELECT id FROM users WHERE email = ?', [em])
  if (existing.length) return { data: null, error: { message: 'User already registered' } }
  const id = crypto.randomUUID()
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  const now = new Date().toISOString()
  db.run('INSERT INTO users (id, email, name, password_salt, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, em, '', salt, hash, now, now])
  const token = crypto.randomBytes(32).toString('hex')
  db.run('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [token, id, now])
  persistNow()
  return { data: { session: makeSession(token, id, em) }, error: null }
}

function authSignIn({ email, password }) {
  const em = String(email || '').trim().toLowerCase()
  const row = queryAll('SELECT * FROM users WHERE email = ?', [em])[0]
  if (!row) return { data: null, error: { message: 'Invalid login credentials' } }
  const expected = crypto.scryptSync(String(password), row.password_salt, 64).toString('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(row.password_hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { data: null, error: { message: 'Invalid login credentials' } }
  }
  const token = crypto.randomBytes(32).toString('hex')
  const now = new Date().toISOString()
  db.run('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [token, row.id, now])
  persistNow()
  return { data: { session: makeSession(token, row.id, row.email) }, error: null }
}

function authGetSession(token) {
  if (!token) return null
  const row = queryAll('SELECT s.token, u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', [String(token)])[0]
  if (!row) return null
  return makeSession(row.token, row.id, row.email)
}

function authSignOut(token) {
  if (!token) return
  db.run('DELETE FROM sessions WHERE token = ?', [String(token)])
  persistNow()
}

function getPaths() {
  return { root: rootPaths().root, dbPath, backupsDir }
}

function backupName() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `BillingApp-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${ms}.db`
}

function createBackup() {
  persistNow()
  const file = path.join(backupsDir, backupName())
  fs.copyFileSync(dbPath, file)
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.db'))
    .sort()
  while (files.length > BACKUP_KEEP) {
    const old = files.shift()
    fs.unlinkSync(path.join(backupsDir, old))
  }
  return { error: null, file: path.basename(file) }
}

function listBackups() {
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const stat = fs.statSync(path.join(backupsDir, f))
      return { name: f, size: stat.size, mtime: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.name.localeCompare(a.name))
  return { error: null, data: files }
}

const MERGE_TABLES = [
  { table: 'users', pk: 'id' },
  { table: 'invoices', pk: 'id' },
  { table: 'user_profiles', pk: 'user_id' },
]

function insertRow(table, row) {
  const cols = Object.keys(row)
  if (!cols.length) return
  db.run(`INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map(c => row[c]))
}

function updateRow(table, pk, row) {
  const cols = Object.keys(row).filter(c => c !== pk)
  if (!cols.length) return
  db.run(`UPDATE "${table}" SET ${cols.map(c => `"${c}" = ?`).join(', ')} WHERE "${pk}" = ?`, [...cols.map(c => row[c]), row[pk]])
}

function mergeBackup(backup) {
  const stats = {}
  for (const t of MERGE_TABLES) {
    let added = 0
    let updated = 0
    const rows = queryAllOn(backup, `SELECT * FROM "${t.table}"`)
    for (const row of rows) {
      const key = row[t.pk]
      if (key == null) continue
      const existing = queryAll(`SELECT * FROM "${t.table}" WHERE "${t.pk}" = ?`, [key])[0]
      if (!existing) {
        insertRow(t.table, row)
        added++
      } else {
        const backupTime = row.updated_at || ''
        const currentTime = existing.updated_at || ''
        if (backupTime >= currentTime) {
          updateRow(t.table, t.pk, row)
          updated++
        }
      }
    }
    stats[t.table] = { added, updated }
  }
  return stats
}

function restoreBackup(name) {
  const safe = path.basename(String(name || ''))
  if (!safe.endsWith('.db')) return { error: { message: 'Invalid backup file' }, data: null }
  const file = path.join(backupsDir, safe)
  if (!fs.existsSync(file)) return { error: { message: 'Backup not found' }, data: null }
  let backup = null
  try {
    const buffer = fs.readFileSync(file)
    backup = new SQL.Database(buffer)
    const rows = queryAllOn(backup, 'PRAGMA integrity_check')
    if (!rows[0] || rows[0].integrity_check !== 'ok') {
      backup.close()
      return { error: { message: 'Backup file is corrupted' }, data: null }
    }
  } catch {
    return { error: { message: 'Backup file is corrupted' }, data: null }
  }
  let autoBackup = null
  try { autoBackup = createBackup().file || null } catch {}
  const merged = mergeBackup(backup)
  backup.close()
  persistNow()
  return { error: null, data: { name: safe, merged, autoBackup } }
}

function queryAllOn(target, sql) {
  const stmt = target.prepare(sql)
  try {
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

function deleteBackup(name) {
  const safe = path.basename(String(name || ''))
  if (!safe.endsWith('.db')) return { error: { message: 'Invalid backup file' }, data: null }
  const file = path.join(backupsDir, safe)
  if (fs.existsSync(file)) fs.unlinkSync(file)
  return { error: null, data: { name: safe } }
}

module.exports = {
  initStore,
  query,
  authSignUp,
  authSignIn,
  authGetSession,
  authSignOut,
  getPaths,
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
}