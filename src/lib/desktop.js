const API = typeof window !== 'undefined' ? window.billingDesktop : null

export const isDesktopMode = !!API

const TOKEN_KEY = 'billing_desktop_token'

let sessionCache = null
let authListeners = []

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
  }
}

function emitAuth(event, session) {
  sessionCache = session
  for (const cb of [...authListeners]) {
    try { cb(event, session) } catch { }
  }
}

async function refreshSession() {
  const token = getToken()
  if (!token) {
    sessionCache = null
    return null
  }
  const res = await API.auth.getSession(token)
  sessionCache = res?.data?.session || null
  return sessionCache
}

const localAuth = {
  async getSession() {
    if (sessionCache) return { data: { session: sessionCache } }
    await refreshSession()
    return { data: { session: sessionCache } }
  },

  async signUp({ email, password }) {
    const res = await API.auth.signUp(email, password)
    if (res.data?.session) setToken(res.data.session.access_token)
    return res.data?.session ? { data: res.data, error: null } : res
  },

  async signInWithPassword({ email, password }) {
    const res = await API.auth.signIn(email, password)
    if (res.data?.session) setToken(res.data.session.access_token)
    return res.data?.session ? { data: res.data, error: null } : res
  },

  async signInWithOAuth() {
    return { data: null, error: { message: 'Google sign-in is only available in the online version.' } }
  },

  async signOut() {
    const token = getToken()
    if (token) await API.auth.signOut(token)
    setToken(null)
    emitAuth('SIGNED_OUT', null)
    return { error: null }
  },

  onAuthStateChange(cb) {
    authListeners.push(cb)
    const off = API.auth.onAuth(payload => {
      if (payload.event === 'SIGNED_IN') {
        setToken(payload.session.access_token)
        emitAuth('SIGNED_IN', payload.session)
      } else if (payload.event === 'SIGNED_OUT') {
        setToken(null)
        emitAuth('SIGNED_OUT', null)
      }
    })
    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners = authListeners.filter(fn => fn !== cb)
            off()
          },
        },
      },
    }
  },
}

function buildQuery() {
  return {
    table: null,
    op: 'select',
    filters: [],
    order: null,
    limit: null,
    selectCols: null,
    data: null,
    conflict: 'id',
  }
}

function makeBuilder(table) {
  const q = buildQuery()
  q.table = table

  const builder = {
    select(cols) { q.selectCols = cols; return builder },
    eq(col, val) { q.filters.push({ col, val }); return builder },
    order(col, { ascending = true } = {}) { q.order = { col, ascending }; return builder },
    limit(n) { q.limit = n; return builder },
    insert(data) { q.op = 'insert'; q.data = data; return builder },
    update(data) { q.op = 'update'; q.data = data; return builder },
    upsert(data, { onConflict = 'id' } = {}) { q.op = 'upsert'; q.data = data; q.conflict = onConflict; return builder },
    delete() { q.op = 'delete'; return builder },
    then(resolve, reject) {
      return API.db(q).then(resolve, reject)
    },
    single() {
      return builder.then(result => {
        let row = null
        if (Array.isArray(result.data) && result.data.length) {
          row = result.data[0]
        } else if (result.data && typeof result.data === 'object') {
          row = result.data
        }
        return { data: row, error: result.error || null }
      })
    },
  }
  return builder
}

const localClient = {
  auth: localAuth,
  from(table) { return makeBuilder(table) },
  rpc() {
    return {
      single: () => Promise.resolve({ data: null, error: { message: 'Shared links are only available in the online version.' } }),
    }
  },
}

export function createLocalAdapter() {
  return localClient
}

export { isDesktopMode as default }