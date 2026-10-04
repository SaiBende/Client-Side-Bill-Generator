import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  AlignmentType,
  Header,
  Footer,
  VerticalAlign,
  TextRun,
  BorderStyle,
  PageOrientation,
  createPageSize,
  convertMillimetersToTwip,
} from 'docx'
import pkg from 'file-saver'
const { saveAs } = pkg

const toDataURL = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = url
  })

const INR = (v) => `₹${Number(v || 0).toFixed(2)}`

const toCamelCaseKeys = (invoice) => invoice // use as-is

export async function exportInvoiceDocx(invoice, calcSubtotal, calcGrandTotal, calcCgst, calcSgst, numberToWords, logo, logoSettings) {
  const inv = toCamelCaseKeys(invoice)
  const grandTotal = calcGrandTotal ? calcGrandTotal() : 0
  const subtotal = calcSubtotal ? calcSubtotal() : 0
  const cgst = calcCgst ? calcCgst() : 0
  const sgst = calcSgst ? calcSgst() : 0
  const gstRate = Math.max(...(inv.items || []).map((i) => i.gstRate || 0))
  const advance = Number(inv.advance) || 0
  const balanceDue = Math.max(0, grandTotal - advance)

  let logoImage
  if (logo) {
    try {
      const dataUrl = logo.startsWith('data:') ? logo : await toDataURL(logo)
      logoImage = {
        data: Buffer.from(dataUrl.split(',')[1], 'base64'),
        transformation: {
          width: logoSettings?.width || 80,
          height: logoSettings?.height || 80,
        },
      }
    } catch {
      logoImage = null
    }
  }

  const isMeasure = inv.billType === 'measurement'

  const children = []

  // Header
  if (logoImage) {
    const align = logoSettings?.position === 'left' ? AlignmentType.LEFT : logoSettings?.position === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER
    children.push(
      new Paragraph({
        alignment: align,
        children: [new ImageRun(logoImage)],
        spacing: { after: 200 },
      })
    )
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: inv.businessName || 'Your Business Name', bold: true, size: 32, font: 'Calibri' })],
      spacing: { after: 50 },
    })
  )

  if (inv.businessAddress) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: inv.businessAddress, size: 20, font: 'Calibri' })],
        spacing: { after: 30 },
      })
    )
  }
  if (inv.businessPhone) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Phone: ${inv.businessPhone}`, size: 20, font: 'Calibri' })],
        spacing: { after: 30 },
      })
    )
  }
  if (inv.businessEmail) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Email: ${inv.businessEmail}`, size: 20, font: 'Calibri' })],
        spacing: { after: 120 },
      })
    )
  }

  // Thin separator
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'INVOICE', bold: true, size: 28, font: 'Calibri' })],
      spacing: { after: 120 },
    })
  )

  // Bill To + Invoice Details
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [50, 50],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.TOP,
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'Bill To:', bold: true, size: 20, font: 'Calibri' })], spacing: { after: 50 } }),
              new Paragraph({ children: [new TextRun({ text: inv.customerName || 'Customer Name', bold: true, size: 20, font: 'Calibri' })], spacing: { after: 40 } }),
              new Paragraph({ children: [new TextRun({ text: inv.customerAddress || '', size: 20, font: 'Calibri' })], spacing: { after: 40 } }),
              new Paragraph({ children: [new TextRun({ text: [inv.customerCity, inv.customerState, inv.customerPincode].filter(Boolean).join(', '), size: 20, font: 'Calibri' })] }),
            ],
          }),
          new TableCell({
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({ children: [new TextRun({ text: `Invoice No: ${inv.invoiceNumber || ''}`, size: 20, font: 'Calibri' })], spacing: { after: 40 } }),
              new Paragraph({ children: [new TextRun({ text: `Date: ${inv.invoiceDate || ''}`, size: 20, font: 'Calibri' })], spacing: { after: 40 } }),
              ...(inv.dueDate ? [new Paragraph({ children: [new TextRun({ text: `Due Date: ${inv.dueDate}`, size: 20, font: 'Calibri' })], spacing: { after: 40 } })] : []),
              ...(inv.enableGst && inv.gstin ? [new Paragraph({ children: [new TextRun({ text: `GSTIN: ${inv.gstin}`, size: 20, font: 'Calibri' })], spacing: { after: 40 } })] : []),
            ],
          }),
        ],
      }),
    ],
  })

  children.push(new Paragraph({ spacing: { before: 120, after: 120 } }))
  children.push(metaTable)
  children.push(new Paragraph({ spacing: { before: 120, after: 120 } }))

  // Items Table
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', bold: true, size: 20, font: 'Calibri' })] })] }),
      ...(inv.enableGst ? [new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'HSN', bold: true, size: 20, font: 'Calibri' })] })] })] : []),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Description', bold: true, size: 20, font: 'Calibri' })] })] }),
      ...(isMeasure
        ? [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Size', bold: true, size: 20, font: 'Calibri' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Qty', bold: true, size: 20, font: 'Calibri' })] })] }),
          ]
        : [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Qty', bold: true, size: 20, font: 'Calibri' })] })] }),
          ]),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Rate', bold: true, size: 20, font: 'Calibri' })] })] }),
      new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Amount', bold: true, size: 20, font: 'Calibri' })] })] }),
    ],
  })

  const itemRows = []
  ;(inv.items || []).forEach((item, idx) => {
    if (isMeasure) {
      const measurementRows = Array.isArray(item.measurements) && item.measurements.length ? item.measurements : [{ width: item.width || '-', height: item.height || '-', unit: item.unit || 'in', quantity: 1 }]
      measurementRows.forEach((m, mi) => {
        const cells = []
        if (mi === 0) {
          cells.push(new TableCell({ verticalAlign: VerticalAlign.TOP, rowSpan: measurementRows.length, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), size: 20, font: 'Calibri' })] })] }))
          if (inv.enableGst) {
            cells.push(new TableCell({ verticalAlign: VerticalAlign.TOP, rowSpan: measurementRows.length, children: [new Paragraph({ children: [new TextRun({ text: item.hsn || '-', size: 20, font: 'Calibri' })] })] }))
          }
          cells.push(new TableCell({ verticalAlign: VerticalAlign.TOP, rowSpan: measurementRows.length, children: [new Paragraph({ children: [new TextRun({ text: item.description || '-', size: 20, font: 'Calibri', bold: true })] })] }))
        }
        cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${m.width || '-'} ${m.unit || 'in'} × ${m.height || '-'} ${m.unit || 'in'}`, size: 20, font: 'Calibri' })] })] }))
        cells.push(new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(m.quantity || 1), size: 20, font: 'Calibri' })] })] }))
        if (mi === 0) {
          cells.push(new TableCell({ verticalAlign: VerticalAlign.TOP, rowSpan: measurementRows.length, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${INR(item.rate)}/sqft`, size: 20, font: 'Calibri' })] })] }))
          const amt = (item.rate || 0) * (item.quantity || 1) // simplified
          cells.push(new TableCell({ verticalAlign: VerticalAlign.TOP, rowSpan: measurementRows.length, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: INR(amt), size: 20, font: 'Calibri', bold: true })] })] }))
        }
        itemRows.push(new TableRow({ children: cells }))
      })
    } else {
      itemRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(idx + 1), size: 20, font: 'Calibri' })] })] }),
            ...(inv.enableGst ? [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.hsn || '-', size: 20, font: 'Calibri' })] })] })] : []),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.description || '-', size: 20, font: 'Calibri' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.quantity || 1), size: 20, font: 'Calibri' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: INR(item.rate), size: 20, font: 'Calibri' })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: INR((item.quantity || 1) * (item.rate || 0)), size: 20, font: 'Calibri', bold: true })] })] }),
          ],
        })
      )
    }
  })

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [headerRow, ...itemRows],
  })

  children.push(itemsTable)
  children.push(new Paragraph({ spacing: { before: 120, after: 120 } }))

  // Totals
  const totalRows = []
  totalRows.push(new Paragraph({ children: [new TextRun({ text: `Subtotal: ${INR(subtotal)}`, size: 20, font: 'Calibri', bold: true })], alignment: AlignmentType.RIGHT }))
  if (inv.enableGst) {
    totalRows.push(new Paragraph({ children: [new TextRun({ text: `Taxable Amount: ${INR(subtotal)}`, size: 20, font: 'Calibri' })], alignment: AlignmentType.RIGHT }))
    totalRows.push(new Paragraph({ children: [new TextRun({ text: `CGST @ ${(gstRate / 2).toFixed(1)}%: ${INR(cgst)}`, size: 20, font: 'Calibri' })], alignment: AlignmentType.RIGHT }))
    totalRows.push(new Paragraph({ children: [new TextRun({ text: `SGST @ ${(gstRate / 2).toFixed(1)}%: ${INR(sgst)}`, size: 20, font: 'Calibri' })], alignment: AlignmentType.RIGHT }))
  }
  if (inv.discount > 0) totalRows.push(new Paragraph({ children: [new TextRun({ text: `Discount: -${INR(inv.discount)}`, size: 20, font: 'Calibri' })], alignment: AlignmentType.RIGHT }))
  if (advance > 0) totalRows.push(new Paragraph({ children: [new TextRun({ text: `Advance Paid: -${INR(advance)}`, size: 20, font: 'Calibri' })], alignment: AlignmentType.RIGHT }))
  totalRows.push(new Paragraph({ children: [new TextRun({ text: `Grand Total: ${INR(grandTotal)}`, size: 22, font: 'Calibri', bold: true })], alignment: AlignmentType.RIGHT, spacing: { before: 60 } }))
  if (advance > 0) totalRows.push(new Paragraph({ children: [new TextRun({ text: `Balance Due: ${INR(balanceDue)}`, size: 20, font: 'Calibri', bold: true })], alignment: AlignmentType.RIGHT, spacing: { before: 40 } }))

  children.push(...totalRows)
  children.push(new Paragraph({ spacing: { before: 120, after: 120 } }))
  children.push(new Paragraph({ children: [new TextRun({ text: `Amount in Words: ${numberToWords ? numberToWords(grandTotal) : ''}`, size: 20, font: 'Calibri' })] }))
  children.push(new Paragraph({ spacing: { before: 120, after: 120 } }))

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
            margins: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  })

  const blob = await Document.create(doc).generateBlob()
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Invoice-${inv.invoiceNumber || 'Invoice'}.docx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default exportInvoiceDocx