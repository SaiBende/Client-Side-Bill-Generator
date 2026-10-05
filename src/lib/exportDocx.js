import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableLayoutType,
  ImageRun,
  AlignmentType,
  Packer,
  VerticalAlign,
  TextRun,
  BorderStyle,
  ShadingType,
  PageOrientation,
  createPageSize,
  convertMillimetersToTwip,
} from 'docx'
import QRCode from 'qrcode'
import { desktopExportFile, isDesktop } from './desktopFiles'
import {
  measurementRows,
  measurementItemAmount,
  measurementRowAreaInPricing,
  formatTotalArea,
  unitLabel,
  areaUnitLabel,
} from './measurements'

const C = {
  gray900: '111827',
  gray800: '1F2937',
  gray700: '374151',
  gray600: '4B5563',
  gray500: '6B7280',
  gray400: '9CA3AF',
  gray300: 'D1D5DB',
  gray200: 'E5E7EB',
  gray100: 'F3F4F6',
  white: 'FFFFFF',
  blue700: '1D4ED8',
  red600: 'DC2626',
  green700: '15803D',
}

const F = {
  xl: 30,
  base: 21,
  sm: 19,
  xs: 18,
  xxs: 16,
  lg: 24,
}

const FONT = 'Calibri'
const px = (n) => n * 15

const PAGE_W = convertMillimetersToTwip(210)
const MARGIN_X = 560
const SHIFT_LEFT = 80
const CONTENT_W = PAGE_W - MARGIN_X * 2
const FRAME_PAD = px(8) * 2
const INNER_W = CONTENT_W - FRAME_PAD
const tw = (pct, avail = INNER_W) => Math.round((avail * pct) / 100)

const thin = (color, size = 6) => ({ style: BorderStyle.SINGLE, size, color })
const noBorder = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder }
const boxBorders = { top: thin(C.gray300), bottom: thin(C.gray300), left: thin(C.gray300), right: thin(C.gray300), insideHorizontal: noBorder, insideVertical: noBorder }

const t = (text, opts = {}) =>
  new TextRun({ text: String(text ?? ''), font: FONT, ...opts })

const p = ({ children = [], align, after = 0, before = 0, border, spacing } = {}) =>
  new Paragraph({
    alignment: align,
    spacing: { after, before, ...(spacing || {}) },
    ...(border ? { border } : {}),
    children,
  })

const cell = ({ children, width, avail, shading, borders = boxBorders, valign, margins, span, rowSpan }) =>
  new TableCell({
    children,
    ...(width != null ? { width: { size: tw(width, avail), type: WidthType.DXA } } : {}),
    ...(shading ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: shading } } : {}),
    ...(borders ? { borders } : {}),
    ...(margins ? { margins } : {}),
    ...(valign ? { verticalAlign: valign } : {}),
    ...(span ? { columnSpan: span } : {}),
    ...(rowSpan ? { rowSpan } : {}),
  })

const PAD = { top: px(6), bottom: px(6), left: px(6), right: px(6) }
const PAD_BOX = { top: px(8), bottom: px(8), left: px(8), right: px(8) }

const layoutTable = (rows, widths, opts = {}) =>
  new Table({
    width: { size: opts.avail || INNER_W, type: WidthType.DXA },
    columnWidths: widths.map((w) => tw(w, opts.avail)),
    layout: TableLayoutType.FIXED,
    ...(opts.align ? { alignment: opts.align } : {}),
    borders: noBorders,
    rows,
  })

const base64ToBytes = (dataUrl) => {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const imageRun = (dataUrl, width, height) =>
  new ImageRun({
    type: 'png',
    data: base64ToBytes(dataUrl),
    transformation: { width, height },
  })

const toDataURL = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })

const INR = (v) => `₹${Number(v || 0).toFixed(2)}`

const toCamelCaseKeys = (invoice) => invoice

export async function exportInvoiceDocx(invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst, numberToWords, logo, logoSettings) {
  const inv = toCamelCaseKeys(invoice)
  const grandTotal = calcGrandTotal ? calcGrandTotal() : 0
  const subtotal = calcSubtotal ? calcSubtotal() : 0
  const cgst = calcCgst ? calcCgst() : 0
  const sgst = calcSgst ? calcSgst() : 0
  const items = inv.items || []
  const gstRate = Math.max(...items.map((i) => i.gstRate || 0))
  const advance = Number(inv.advance) || 0
  const balanceDue = Math.max(0, grandTotal - advance)
  const isMeasure = inv.billType === 'measurement'
  const showHsn = !!inv.enableGst

  let logoDataUrl = null
  if (logo) {
    try {
      logoDataUrl = logo.startsWith('data:') ? logo : await toDataURL(logo)
    } catch {
      logoDataUrl = null
    }
  }

  let qrDataUrl = null
  if (inv.upiId) {
    try {
      qrDataUrl = await QRCode.toDataURL(
        `upi://pay?pa=${encodeURIComponent(inv.upiId)}&pn=${encodeURIComponent(inv.upiName || inv.businessName || 'Business')}&am=${grandTotal.toFixed(2)}&tn=${encodeURIComponent(inv.invoiceNumber || 'Invoice')}&cu=INR`,
        { width: 160, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } }
      )
    } catch {
      qrDataUrl = null
    }
  }

  const children = []

  if (logoDataUrl) {
    const align = logoSettings?.position === 'left' ? AlignmentType.LEFT : logoSettings?.position === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER
    children.push(
      p({
        align,
        after: 40,
        children: [imageRun(logoDataUrl, logoSettings?.width || 80, logoSettings?.height || 80)],
      })
    )
  }

  children.push(
    p({
      align: AlignmentType.CENTER,
      after: 20,
      children: [
        t(inv.businessName || 'Your Business Name', {
          bold: true,
          allCaps: true,
          color: C.gray900,
          size: F.xl,
          characterSpacing: 10,
        }),
      ],
    })
  )
  children.push(p({ align: AlignmentType.CENTER, after: 20, children: [t(inv.businessAddress || 'Your Address', { color: C.gray600, size: F.sm })] }))
  if (inv.businessPhone) children.push(p({ align: AlignmentType.CENTER, after: 20, children: [t(`Phone: ${inv.businessPhone}`, { color: C.gray600, size: F.sm })] }))
  if (inv.businessEmail) children.push(p({ align: AlignmentType.CENTER, after: 120, children: [t(`Email: ${inv.businessEmail}`, { color: C.gray600, size: F.sm })] }))

  children.push(p({ after: 40, border: { bottom: thin(C.gray900, 12) } }))

  const metaPairs = [
    ['Invoice No:', inv.invoiceNumber],
    ['Date:', inv.invoiceDate],
    ...(inv.dueDate ? [['Due Date:', inv.dueDate]] : []),
    ...(inv.enableGst && inv.gstin ? [['GSTIN:', inv.gstin]] : []),
  ]

  const META_L_BORDERS = { ...boxBorders, right: noBorder }
const META_R_BORDERS = { ...boxBorders, left: noBorder }

  children.push(
    layoutTable(
      [
        new TableRow({
          children: [
            cell({
              width: 47,
              margins: PAD_BOX,
              children: [
                p({ after: 20, children: [t('Bill To:', { bold: true, color: C.gray900, size: F.base })] }),
                p({ after: 40, children: [t(inv.customerName || 'Customer Name', { bold: true, color: C.gray800, size: F.base })] }),
                ...(inv.customerAddress ? [p({ after: 0, children: [t(inv.customerAddress, { color: C.gray600, size: F.sm })] })] : []),
                p({ children: [t([inv.customerCity, inv.customerState, inv.customerPincode].filter(Boolean).join(', '), { color: C.gray600, size: F.sm })] }),
              ],
            }),
            cell({ width: 3, borders: noBorders, children: [p({})] }),
            cell({
              width: 23,
              borders: META_L_BORDERS,
              margins: PAD_BOX,
              children: metaPairs.map(([label]) => p({ after: 20, children: [t(label, { bold: true, color: C.gray700, size: F.sm })] })),
            }),
            cell({
              width: 27,
              borders: META_R_BORDERS,
              margins: PAD_BOX,
              children: metaPairs.map(([, value]) => p({ align: AlignmentType.RIGHT, after: 20, children: [t(value || '', { color: C.gray800, size: F.sm })] })),
            }),
          ],
        }),
      ],
      [47, 3, 23, 27]
    )
  )

  children.push(p({ after: 100 }))

  const cols = [
    { key: 'index', label: '#', w: 5, align: AlignmentType.LEFT },
    ...(showHsn ? [{ key: 'hsn', label: 'HSN', w: isMeasure ? 10 : 12, align: AlignmentType.LEFT }] : []),
    { key: 'desc', label: 'Description', w: null, align: AlignmentType.LEFT },
    ...(isMeasure ? [{ key: 'size', label: 'Size', w: 22, align: AlignmentType.LEFT }] : []),
    { key: 'qty', label: 'Qty', w: isMeasure ? 8 : 10, align: AlignmentType.CENTER },
    { key: 'rate', label: 'Rate', w: isMeasure ? 15 : 13, align: AlignmentType.RIGHT },
    { key: 'amount', label: 'Amount', w: 17, align: AlignmentType.RIGHT },
  ]
  const fixed = cols.reduce((s, c) => s + (c.w || 0), 0)
  const descWidth = 100 - fixed
  cols.forEach((c) => {
    if (c.w === null) c.w = descWidth
  })

  const colWidth = Object.fromEntries(cols.map((c) => [c.key, c.w]))

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: cols.map((c) =>
      cell({
        width: c.w,
        shading: C.gray900,
        margins: PAD,
        children: [p({ align: c.align, children: [t(c.label, { bold: true, color: C.white, size: F.sm })] })],
      })
    ),
  })

  const bodyRow = (cells) =>
    new TableRow({
      cantSplit: true,
      children: cells.map((c, ci) =>
        cell({
          width: c.w != null ? c.w : cols[ci].w,
          margins: PAD,
          valign: c.valign,
          rowSpan: c.rowSpan,
          borders: { ...boxBorders, insideHorizontal: thin(C.gray200), insideVertical: thin(C.gray200) },
          children: c.children,
        })
      ),
    })

  const itemRows = []

  items.forEach((item, index) => {
    if (isMeasure) {
      const rows = measurementRows(item)
      rows.forEach((m, mi) => {
        const cells = []
        if (mi === 0) {
          cells.push({ children: [p({ align: AlignmentType.LEFT, children: [t(index + 1, { color: C.gray700, size: F.sm })] })], valign: VerticalAlign.TOP, rowSpan: rows.length })
          if (showHsn) {
            cells.push({ children: [p({ children: [t(item.hsn || '-', { color: C.gray600, size: F.xs })] })], valign: VerticalAlign.TOP, rowSpan: rows.length })
          }
          cells.push({
            children: [
              p({
                children: [
                  t(item.description || '-', { color: C.gray800, size: F.sm }),
                  t(`Total: ${formatTotalArea(item)}`, { color: C.blue700, size: F.xxs, bold: true, break: 1 }),
                ],
              }),
            ],
            valign: VerticalAlign.TOP,
            rowSpan: rows.length,
          })
        }
        cells.push({
          w: colWidth.size,
          children: [
            p({ children: [t(`${m.width || '-'} ${unitLabel(m.unit)} × ${m.height || '-'} ${unitLabel(m.unit)}`, { color: C.gray800, size: F.sm })] }),
            p({ children: [t(`${measurementRowAreaInPricing(m, item.areaUnit).toFixed(2)} ${areaUnitLabel(item.areaUnit)}`, { color: C.gray500, size: F.xxs })] }),
          ],
        })
        cells.push({ w: colWidth.qty, children: [p({ align: AlignmentType.CENTER, children: [t(m.quantity, { color: C.gray800, size: F.sm })] })] })
        if (mi === 0) {
          cells.push({
            children: [p({ align: AlignmentType.RIGHT, children: [t(`${INR(item.rate)}/${areaUnitLabel(item.areaUnit)}`, { color: C.gray800, size: F.sm })] })],
            valign: VerticalAlign.TOP,
            rowSpan: rows.length,
          })
          cells.push({
            children: [p({ align: AlignmentType.RIGHT, children: [t(INR(measurementItemAmount(item)), { color: C.gray800, size: F.sm, bold: true })] })],
            valign: VerticalAlign.TOP,
            rowSpan: rows.length,
          })
        }
        itemRows.push(bodyRow(cells))
      })
    } else {
      itemRows.push(
        bodyRow([
          { children: [p({ children: [t(index + 1, { color: C.gray700, size: F.sm })] })] },
          ...(showHsn ? [{ children: [p({ children: [t(item.hsn || '-', { color: C.gray600, size: F.xs })] })] }] : []),
          { children: [p({ children: [t(item.description || '-', { color: C.gray800, size: F.sm })] })] },
          { children: [p({ align: AlignmentType.CENTER, children: [t(item.quantity, { color: C.gray800, size: F.sm })] })] },
          { children: [p({ align: AlignmentType.RIGHT, children: [t(INR(item.rate), { color: C.gray800, size: F.sm })] })] },
          { children: [p({ align: AlignmentType.RIGHT, children: [t(INR((item.quantity || 1) * (item.rate || 0)), { color: C.gray800, size: F.sm, bold: true })] })] },
        ])
      )
    }
  })

  if (items.length === 0) {
    itemRows.push(
      new TableRow({
        children: [
          cell({
            span: cols.length,
            shading: C.gray100,
            children: [p({ align: AlignmentType.CENTER, children: [t('No items added', { color: C.gray400, size: F.sm })] })],
          }),
        ],
      })
    )
  }

  children.push(
    new Table({
      width: { size: INNER_W, type: WidthType.DXA },
      columnWidths: cols.map((c) => tw(c.w)),
      layout: TableLayoutType.FIXED,
      borders: { ...boxBorders, insideHorizontal: thin(C.gray200), insideVertical: thin(C.gray200) },
      rows: [headerRow, ...itemRows],
    })
  )

  children.push(p({ after: 100 }))

  const totalRow = (label, value, opts = {}) => {
    const borders = opts.rule
      ? { ...noBorders, bottom: thin(C.gray900, 12) }
      : opts.topRule
        ? { ...noBorders, top: thin(C.gray400) }
        : noBorders
    return new TableRow({
      children: [
        cell({
          borders,
          width: 26,
          avail: tw(40),
          margins: { top: 20, bottom: 20, left: 0, right: px(6) },
          children: [p({ children: [t(label, { bold: true, color: opts.labelColor || C.gray700, size: opts.size || F.base })] })],
        }),
        cell({
          borders,
          width: 74,
          avail: tw(40),
          margins: { top: 20, bottom: 20, left: 0, right: 0 },
          children: [p({ align: AlignmentType.RIGHT, children: [t(value, { bold: true, color: opts.color || C.gray800, size: opts.size || F.base })] })],
        }),
      ],
    })
  }

  children.push(
    layoutTable(
      [
        totalRow('Subtotal:', INR(subtotal)),
        ...(inv.enableGst
          ? [
              totalRow('Taxable Amount:', INR(subtotal), { color: C.gray600, labelColor: C.gray600, size: F.sm }),
              totalRow(`CGST @ ${(gstRate / 2).toFixed(1)}%:`, INR(cgst), { color: C.gray600, labelColor: C.gray600, size: F.sm }),
              totalRow(`SGST @ ${(gstRate / 2).toFixed(1)}%:`, INR(sgst), { color: C.gray600, labelColor: C.gray600, size: F.sm }),
            ]
          : []),
        ...(inv.discount > 0 ? [totalRow('Discount:', `-${INR(inv.discount)}`, { color: C.red600 })] : []),
        ...(advance > 0 ? [totalRow('Advance Paid:', `-${INR(advance)}`, { color: C.green700 })] : []),
        totalRow('Grand Total:', INR(grandTotal), { rule: true, color: C.gray900, labelColor: C.gray900, size: F.lg }),
        ...(advance > 0 ? [totalRow('Balance Due:', INR(balanceDue), { topRule: true, color: C.gray900, labelColor: C.gray900 })] : []),
      ],
      [26, 74],
      { avail: tw(40), align: AlignmentType.RIGHT }
    )
  )

  children.push(p({ after: 100 }))

  children.push(
    layoutTable(
      [
        new TableRow({
          children: [
            cell({
              margins: PAD_BOX,
              children: [
                p({
                  children: [
                    t('Amount in Words: ', { bold: true, color: C.gray700, size: F.base }),
                    t(numberToWords ? numberToWords(grandTotal) : '', { color: C.gray800, size: F.base }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
      [100]
    )
  )

  children.push(p({ after: 100 }))

  const bankLines = [
    ...(inv.bankName ? [`Bank: ${inv.bankName}`] : []),
    ...(inv.bankAccount ? [`A/c No: ${inv.bankAccount}`] : []),
    ...(inv.bankIfsc ? [`IFSC: ${inv.bankIfsc}`] : []),
    ...(inv.bankBranch ? [`Branch: ${inv.bankBranch}`] : []),
  ]

  children.push(
    layoutTable(
      [
        new TableRow({
          children: [
            cell({
              borders: noBorders,
              margins: { top: 0, bottom: 0, left: 0, right: px(10) },
              width: 50,
              children: [
                p({ after: 20, children: [t('Bank Details:', { bold: true, color: C.gray900, size: F.base })] }),
                ...(bankLines.length
                  ? bankLines.map((line) => p({ after: 20, children: [t(line, { color: C.gray700, size: F.sm })] }))
                  : [p({ children: [t('N/A', { color: C.gray700, size: F.sm })] })]),
                ...(inv.upiId
                  ? [
                      p({
                        before: 60,
                        border: { top: thin(C.gray200) },
                        children: [
                          t('UPI: ', { bold: true, color: C.green700, size: F.sm }),
                          t(`${inv.upiId}${inv.upiName ? ` (${inv.upiName})` : ''}`, { color: C.gray700, size: F.sm }),
                        ],
                      }),
                    ]
                  : []),
              ],
            }),
            cell({
              borders: noBorders,
              margins: { top: 0, bottom: 0, left: px(10), right: 0 },
              width: 50,
              children: [
                p({ align: AlignmentType.RIGHT, after: 20, children: [t('Terms & Conditions:', { bold: true, color: C.gray900, size: F.base })] }),
                p({ align: AlignmentType.RIGHT, children: [t(inv.terms || 'N/A', { color: C.gray700, size: F.sm })] }),
                ...(inv.signature
                  ? [
                      p({ align: AlignmentType.RIGHT, before: 80, border: { top: thin(C.gray300) }, children: [t(`for ${inv.businessName || 'Your Business'}`, { bold: true, color: C.gray800, size: F.base })] }),
                      p({ align: AlignmentType.RIGHT, before: 200 }),
                      p({ align: AlignmentType.RIGHT, after: 20, children: [t(`(${inv.signature})`, { bold: true, color: C.gray800, size: F.base })] }),
                      p({ align: AlignmentType.RIGHT, children: [t('Authorized Signatory', { color: C.gray600, size: F.xs })] }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
      [50, 50]
    )
  )

  if (inv.upiId && qrDataUrl) {
    children.push(
      layoutTable(
        [
          new TableRow({
            children: [
              cell({
                borders: { ...noBorders, top: thin(C.gray900, 12) },
                margins: { top: px(8), bottom: px(8), left: px(8), right: px(8) },
                width: 12,
                children: [p({ align: AlignmentType.CENTER, children: [imageRun(qrDataUrl, 64, 64)] })],
              }),
              cell({
                borders: { ...noBorders, top: thin(C.gray900, 12) },
                margins: { top: px(8), bottom: px(8), left: px(6), right: px(6) },
                width: 88,
                children: [
                  p({ after: 20, children: [t('Pay with UPI', { bold: true, color: C.gray900, size: F.base })] }),
                  p({
                    after: 20,
                    children: [
                      t('UPI ID: ', { color: C.gray600, size: F.sm }),
                      t(inv.upiId, { color: C.gray800, size: F.sm, bold: true }),
                    ],
                  }),
                  p({
                    children: [
                      t('Amount: ', { color: C.gray600, size: F.sm }),
                      t(INR(grandTotal), { bold: true, color: C.gray900, size: F.sm }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
        [12, 88]
      )
    )
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: createPageSize({
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
              orientation: PageOrientation.PORTRAIT,
            }),
            margin: { top: 480, right: MARGIN_X + SHIFT_LEFT, bottom: 480, left: MARGIN_X - SHIFT_LEFT },
          },
        },
        children: [
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            columnWidths: [CONTENT_W],
            layout: TableLayoutType.FIXED,
            borders: boxBorders,
            rows: [
              new TableRow({
                children: [
                  cell({
                    borders: noBorders,
                    margins: PAD_BOX,
                    children: [
                      ...children,
                      layoutTable(
                        [
                          new TableRow({
                            children: [
                              cell({
                                borders: noBorders,
                                shading: C.gray100,
                                margins: { top: px(6), bottom: px(6), left: 0, right: 0 },
                                children: [p({ align: AlignmentType.CENTER, children: [t('This is a computer generated invoice', { color: C.gray500, size: F.xxs })] })],
                              }),
                            ],
                          }),
                        ],
                        [100]
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `Invoice-${inv.invoiceNumber || 'Invoice'}.docx`

  if (isDesktop) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return desktopExportFile(
      filename,
      `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${btoa(binary)}`,
      { ask: true }
    )
  }

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => window.URL.revokeObjectURL(url), 10000)
  return { canceled: false, error: null, path: null }
}

export default exportInvoiceDocx
