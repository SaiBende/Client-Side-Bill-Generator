import { measurementItemAmount } from './measurements'

export function calcSubtotal(items, billType) {
  if (!Array.isArray(items)) return 0
  if (billType === 'measurement') {
    return items.reduce((sum, item) => sum + measurementItemAmount(item), 0)
  }
  return items.reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0)
}

export function calcGstRate(items) {
  const rates = (Array.isArray(items) ? items : []).map(i => i.gstRate || 0)
  return rates.length ? Math.max(...rates) : 0
}

export function isInterState(taxType) {
  return taxType === 'inter'
}

export function calcIgst(items, billType, enableGst, taxType) {
  if (!enableGst || !isInterState(taxType)) return 0
  return (calcSubtotal(items, billType) * calcGstRate(items)) / 100
}

export function calcCgst(items, billType, enableGst, taxType) {
  if (!enableGst || isInterState(taxType)) return 0
  return (calcSubtotal(items, billType) * calcGstRate(items)) / 200
}

export function calcSgst(items, billType, enableGst, taxType) {
  return calcCgst(items, billType, enableGst, taxType)
}

export function calcGrandTotal({ items, billType, enableGst, discount, taxType }) {
  const subtotal = calcSubtotal(items, billType)
  if (!enableGst) return subtotal - (discount || 0)
  if (isInterState(taxType)) return subtotal + calcIgst(items, billType, enableGst, taxType) - (discount || 0)
  const cgst = calcCgst(items, billType, enableGst, taxType)
  return subtotal + cgst + calcSgst(items, billType, enableGst, taxType) - (discount || 0)
}

export function rowGrandTotal(row) {
  const stored = Number(row?.grand_total)
  if (Number.isFinite(stored) && stored !== 0) return stored
  return calcGrandTotal({
    items: row?.items,
    billType: row?.bill_type,
    enableGst: row?.enable_gst,
    discount: row?.discount,
    taxType: row?.tax_type,
  })
}
