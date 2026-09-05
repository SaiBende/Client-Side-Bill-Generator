const LOGO_KEY = 'billing_logo'
const LOGO_SETTINGS_KEY = 'billing_logo_settings'

export const DEFAULT_LOGO_SETTINGS = { position: 'center', width: 80, height: 80 }

export function getStoredLogo() {
  try {
    return JSON.parse(localStorage.getItem(LOGO_KEY)) || null
  } catch {
    return null
  }
}

export function getStoredLogoSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOGO_SETTINGS_KEY))
    return raw ? { ...DEFAULT_LOGO_SETTINGS, ...raw } : { ...DEFAULT_LOGO_SETTINGS }
  } catch {
    return { ...DEFAULT_LOGO_SETTINGS }
  }
}

export function storeLogoSettings(settings) {
  try {
    localStorage.setItem(LOGO_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
  }
}

export function storeLogo(dataUrl) {
  try {
    localStorage.setItem(LOGO_KEY, JSON.stringify(dataUrl))
  } catch {
  }
}

export function clearStoredLogo() {
  try {
    localStorage.removeItem(LOGO_KEY)
  } catch {
  }
}

export function resizeLogo(file, maxDim = 400) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        try {
          resolve({ dataUrl: canvas.toDataURL('image/png'), width, height })
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = reader.result
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}