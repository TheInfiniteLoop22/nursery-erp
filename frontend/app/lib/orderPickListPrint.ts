/**
 * Browser print for work order line details (products, zones, quantities) — no prices.
 */

export type OrderPickListLine = {
  productName: string
  size: string
  quantity: number
  zoneLabel: string
  sectionLabel: string
  productId?: string
  /** When set on any line, a scan progress column is included. */
  scannedQuantity?: number
}

export type OrderPickListInput = {
  orderId: string
  clientName: string
  designerName?: string | null
  status?: string
  orderedAt?: string | Date | null
  lines: OrderPickListLine[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDateOnly(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

function buildRows(lines: OrderPickListLine[], showScanned: boolean): string {
  return lines
    .map((line, index) => {
      const pid = line.productId?.trim()
        ? `<div class="muted small">${escapeHtml(line.productId!)}</div>`
        : ''
      const scannedCell = showScanned
        ? `<td class="num">${line.scannedQuantity ?? 0}</td>`
        : ''
      return `<tr>
        <td class="num">${index + 1}</td>
        <td>
          <strong>${escapeHtml(line.productName)}</strong>
          ${pid}
        </td>
        <td>${escapeHtml(line.size)}</td>
        <td>${escapeHtml(line.sectionLabel)}</td>
        <td>${escapeHtml(line.zoneLabel)}</td>
        <td class="num">${line.quantity}</td>
        ${scannedCell}
      </tr>`
    })
    .join('')
}

/**
 * Opens a print dialog with a pick list (no pricing). Call from a click handler so pop-ups are allowed.
 */
export function printOrderPickList(input: OrderPickListInput): void {
  const { orderId, clientName, designerName, status, orderedAt, lines } = input
  const showScanned = lines.some((l) => l.scannedQuantity !== undefined)
  const thScanned = showScanned ? '<th class="num">Scanned</th>' : ''
  const title = `Work order ${orderId}`

  const metaParts: string[] = []
  if (orderedAt) {
    const d = formatDateOnly(orderedAt)
    if (d) metaParts.push(`Ordered: ${escapeHtml(d)}`)
  }
  if (status) metaParts.push(`Status: ${escapeHtml(status.replace(/_/g, ' '))}`)
  if (designerName) metaParts.push(`Designer: ${escapeHtml(designerName)}`)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px 20px; color: #111; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { font-size: 0.95rem; color: #444; margin-bottom: 12px; }
    .meta { font-size: 0.8rem; color: #555; margin-bottom: 16px; line-height: 1.5; }
    .brand { font-size: 0.75rem; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; font-weight: 600; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .muted { color: #666; }
    .small { font-size: 0.75rem; margin-top: 2px; }
    .foot { margin-top: 20px; font-size: 0.75rem; color: #666; }
    @media print {
      body { padding: 0; }
      @page { margin: 12mm; }
    }
  </style>
</head>
<body>
  <p class="brand">Nursery ERP — Work order (no prices)</p>
  <h1>${escapeHtml(orderId)}</h1>
  <p class="sub">Client: <strong>${escapeHtml(clientName)}</strong></p>
  ${metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Product</th>
        <th>Size</th>
        <th>Section</th>
        <th>Location</th>
        <th class="num">Qty</th>
        ${thScanned}
      </tr>
    </thead>
    <tbody>
      ${buildRows(lines, showScanned)}
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) {
    throw new Error('Could not open print window. Allow pop-ups for this site and try again.')
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
}
