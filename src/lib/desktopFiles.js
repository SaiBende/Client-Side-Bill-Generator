const api = typeof window !== 'undefined' ? window.billingDesktop : null

const isDesktop = !!api

export async function desktopExportFile(name, dataUrl, { ask = false } = {}) {
  if (!api) return { error: { message: 'Not available' }, path: null, canceled: false }
  return api.files.save({ name, dataUrl, ask })
}

export function desktopReveal(filePath) {
  if (api && filePath) api.files.reveal(filePath)
}

export { isDesktop }