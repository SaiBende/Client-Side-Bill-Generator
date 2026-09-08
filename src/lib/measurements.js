const SQ_INCHES_PER_SQ_FOOT = 144

export function toInches(value, unit) {
  const v = Number(value) || 0
  return unit === 'ft' ? v * 12 : v
}

export function measurementRows(item) {
  if (Array.isArray(item?.measurements)) return item.measurements
  return [{ width: item?.width, height: item?.height, unit: item?.unit, quantity: Number(item?.quantity) || 1 }]
}

export function measurementRowAreaInPricing(m, areaUnit) {
  const sqIn = toInches(m?.width, m?.unit) * toInches(m?.height, m?.unit)
  return areaUnit === 'sqft' ? sqIn / SQ_INCHES_PER_SQ_FOOT : sqIn
}

export function measurementTotalArea(item) {
  return measurementRows(item).reduce((sum, m) => sum + measurementRowAreaInPricing(m, item?.areaUnit) * (Number(m?.quantity) || 0), 0)
}

export function measurementItemAmount(item) {
  return measurementTotalArea(item) * (Number(item?.rate) || 0)
}

export function measurementRowAmount(item, m) {
  return measurementRowAreaInPricing(m, item?.areaUnit) * (Number(m?.quantity) || 0) * (Number(item?.rate) || 0)
}

export function formatTotalArea(item, digits = 2) {
  return `${measurementTotalArea(item).toFixed(digits)} ${areaUnitLabel(item?.areaUnit)}`
}

export function unitLabel(unit) {
  return unit === 'ft' ? 'ft' : 'in'
}

export function areaUnitLabel(unit) {
  return unit === 'sqft' ? 'sq ft' : 'sq in'
}