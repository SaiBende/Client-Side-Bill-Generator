const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('billingDesktop', {
  isDesktop: true,
  paths: () => ipcRenderer.invoke('billing:paths'),
  db: (op) => ipcRenderer.invoke('billing:db', op),
  auth: {
    getSession: (token) => ipcRenderer.invoke('billing:auth:getSession', token),
    signUp: (email, password) => ipcRenderer.invoke('billing:auth:signUp', email, password),
    signIn: (email, password) => ipcRenderer.invoke('billing:auth:signIn', email, password),
    signOut: (token) => ipcRenderer.invoke('billing:auth:signOut', token),
    onAuth: (cb) => {
      const listener = (_event, payload) => cb(payload)
      ipcRenderer.on('billing:auth', listener)
      return () => ipcRenderer.removeListener('billing:auth', listener)
    },
  },
  backup: {
    create: () => ipcRenderer.invoke('billing:backup:create'),
    list: () => ipcRenderer.invoke('billing:backup:list'),
    restore: (name) => ipcRenderer.invoke('billing:backup:restore', name),
    del: (name) => ipcRenderer.invoke('billing:backup:delete', name),
    openFolder: () => ipcRenderer.invoke('billing:backup:open'),
  },
  files: {
    save: (payload) => ipcRenderer.invoke('files:save', payload),
    reveal: (fp) => ipcRenderer.invoke('files:reveal', fp),
  },
})