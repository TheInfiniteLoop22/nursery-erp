import JsBarcode from 'jsbarcode';

/**
 * Physical layout: **one sheet** = four vertical strips side by side (wrap tags).
 * Each strip: 1" wide × 6" tall. Full sheet: 4" × 6".
 */
export const LABEL_LAYOUT = {
  /** Width of a single vertical strip (inches) */
  stripWidthIn: 1,
  /** Height of the sheet / each strip (inches) */
  stripHeightIn: 6,
  linerLeftIn: 0.05,
  linerRightIn: 0.05,
  barcodesPerLabel: 4,
  topBottomMarginIn: 0.1,
} as const;

/** Full label sheet width = strips × strip width (inches) */
export const sheetWidthIn =
  LABEL_LAYOUT.stripWidthIn * LABEL_LAYOUT.barcodesPerLabel;

/** Full label sheet height (inches) */
export const sheetHeightIn = LABEL_LAYOUT.stripHeightIn;

/** Barcodes per physical sheet (four 1″ strips on a 4″×6″ sheet). */
export function barcodesPerPhysicalSheet(): number {
  return LABEL_LAYOUT.barcodesPerLabel;
}

/**
 * How many physical sheets to print (ceil division into groups of 4).
 * Barcodes 1–4 → one sheet; 5–8 → two sheets; etc. The 5th sticker always starts a new paper.
 */
export function physicalSheetsForBarcodeCount(totalBarcodes: number): number {
  const total = Math.max(0, Math.floor(totalBarcodes));
  if (total === 0) return 0;
  return Math.ceil(total / LABEL_LAYOUT.barcodesPerLabel);
}

/** Extra fields for the label; merged with `productName` into name + size line before the barcode. */
export type BarcodePrintLabelExtras = {
  section?: string
  height?: string
  caliper?: string
  gallons?: string | number | null
}

export type BarcodeLabelPrintText = {
  name: string
  height: string
  caliper: string
  gallons: string
  /** Single line: section-aware size (omits missing fields, never shows N/A). */
  sizeLine: string
}

function hasVisibleValue(v: string | null | undefined): boolean {
  const t = String(v ?? '').trim()
  if (!t) return false
  const n = t.toLowerCase()
  return n !== 'n/a' && n !== 'na' && n !== '-'
}

/** Last two digits of the year (e.g. 2026 → `26`) for barcode size line suffix. */
function barcodeLabelTwoDigitYear(date: Date = new Date()): string {
  return String(date.getFullYear() % 100).padStart(2, '0')
}

/**
 * Compact human-readable size line on the label (not EAN payload):
 * - **Trees**: height string + caliper string + YY (each part omitted if N/A/empty).
 * - **Shrubs**: height + gallons + YY.
 * - **Perennials**: gallons + YY only.
 */
function buildBarcodeSizeLine(extras?: BarcodePrintLabelExtras): string {
  const section = String(extras?.section || '').trim().toLowerCase()
  const yy = barcodeLabelTwoDigitYear()
  const heightPart = hasVisibleValue(extras?.height) ? String(extras?.height).trim() : ''
  const caliperPart = hasVisibleValue(extras?.caliper) ? String(extras?.caliper).trim() : ''
  const gallonsRaw = String(extras?.gallons ?? '').trim()
  const gallonsPart = hasVisibleValue(gallonsRaw) ? gallonsRaw : ''

  if (section === 'perennials') {
    return `${gallonsPart}${yy}`
  }
  if (section === 'shrubs') {
    return `${heightPart}${gallonsPart}${yy}`
  }
  // tree and unknown section: height + caliper + year
  return `${heightPart}${caliperPart}${yy}`
}

/** TSPL quoted strings: strip CR/LF, escape `"` as \\["]; optional max length for printer buffer (~4k). */
const TSPL_QUOTED_MAX_CHARS = 4000;

function sanitizeTsplQuotedString(
  s: string,
  maxLen: number = TSPL_QUOTED_MAX_CHARS
): string {
  const t = s.replace(/[\r\n]/g, ' ').trim().replace(/"/g, '\\["]');
  if (maxLen > 0 && t.length > maxLen) return t.slice(0, maxLen);
  return t;
}

/** Split a long line into segments that fit one column at ~font 2 1× (dots). */
function segmentTsplTextForColumnWidth(
  full: string,
  colWidthDots: number,
  textPadDots: number
): string[] {
  if (!full) return [''];
  const charDots = 11;
  const maxChars = Math.max(
    6,
    Math.floor((colWidthDots - textPadDots * 2) / charDots)
  );
  if (full.length <= maxChars) return [full];
  const out: string[] = [];
  for (let p = 0; p < full.length; p += maxChars) {
    out.push(full.slice(p, p + maxChars));
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildLabelText(
  productName: string,
  extras?: BarcodePrintLabelExtras
): BarcodeLabelPrintText {
  return {
    name: (productName || '').trim() || '—',
    height: (extras?.height ?? '').trim(),
    caliper: (extras?.caliper ?? '').trim(),
    gallons: extras?.gallons === null || extras?.gallons === undefined ? '' : String(extras.gallons).trim(),
    sizeLine: buildBarcodeSizeLine(extras),
  };
}

/**
 * Rendered width of the SVG along the label strip (browser print path).
 * Calibrated for reliable scans: denser than ~1.4in matched “too narrow” output on 203 dpi stock.
 */
export const STANDARD_BARCODE_WIDTH = '2.05in' as const;

/** JsBarcode module width (px). Higher = wider X-dimension; keep in sync with STANDARD_BARCODE_WIDTH. */
const JSBARCODE_EAN13_MODULE_WIDTH = 4;

/** Convert to 12-digit EAN */
export const convertToEAN13Format = (productId: string): string => {
  if (/^\d{12}$/.test(productId)) return productId;

  const digits = productId.replace(/\D/g, '');
  if (digits.length === 0) return '200000000000';
  if (digits.length >= 12) return digits.substring(0, 12);

  return digits.padStart(12, '0');
};

/** Check digit */
export const calculateEAN13CheckDigit = (code: string): string => {
  if (!/^\d{12}$/.test(code)) {
    return '?';
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const r = sum % 10;
  return r === 0 ? '0' : String(10 - r);
};

/** SVG barcode (bars horizontal before rotation; rotate 90° on narrow strip) */
export const generateBarcodeImage = (productId: string): string => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const ean = convertToEAN13Format(productId);

  JsBarcode(svg, ean, {
    format: 'EAN13',
    /* Module width — larger bars scan more reliably when printed. */
    width: JSBARCODE_EAN13_MODULE_WIDTH,
    height: 120,
    displayValue: true,
    fontSize: 18,
    textMargin: 6,
    margin: 10,
    valid(valid) {
      if (!valid) {
        throw new Error(`Invalid EAN-13 code: ${ean}`);
      }
    },
  });

  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return svg.outerHTML;
};

/**
 * TSPL: `totalBarcodes` = exact count to print (e.g. initial inventory).
 * Fills 4"×6" sheets with up to 4 EAN-13s each, then additional sheets as needed.
 * `labelText`: long names split into multiple right-aligned TEXT rows in the column; size line under name block. TSPL alignment 3; x at column right edge.
 */
export const generateTSPLCommands = (
  productId: string,
  totalBarcodes = 1,
  labelText: BarcodeLabelPrintText
): string => {
  const ean = convertToEAN13Format(productId);
  const total = Math.max(0, Math.floor(totalBarcodes));

  const dpi = 203;
  const inchesToDots = (i: number) => Math.round(i * dpi);

  const { stripHeightIn, linerLeftIn, linerRightIn, barcodesPerLabel } = LABEL_LAYOUT;

  const sheetW = sheetWidthIn;
  const heightDots = inchesToDots(stripHeightIn);

  const left = inchesToDots(linerLeftIn);
  const printableWidth = inchesToDots(sheetW - linerLeftIn - linerRightIn);
  const colWidth = Math.floor(printableWidth / barcodesPerLabel);

  /**
   * TSPL EAN-13 sizing (203 dpi).
   * With rotation 0, EAN-13 needs ~95×narrow dots horizontally; a ~1″ column caps narrow at 2 (too dense for many guns).
   * Rotation 1 = 90° so the symbol runs along the 6″ strip — we can use narrow 3–4 for a much wider X-dimension.
   */
  const ean13BarHeightDots = 128;
  const ean13NarrowDots = 4;
  /** TSC EAN-13 examples use matching narrow/wide (e.g. 4,4). */
  const ean13WideDots = 4;
  /** TSC TSPL: 0, 90, 180, or 270 (degrees clockwise). */
  const ean13Rotation = 90;
  const ean13ModuleCount = 95;
  const symbolSpanDots = ean13ModuleCount * ean13NarrowDots;

  // CRLF line endings; use GAP 0,0 for continuous stock — use "GAP 2 mm, 0 mm" if your media has die cuts
  let cmd = '';
  cmd += `SIZE ${sheetW * 25.4} mm, ${stripHeightIn * 25.4} mm\r\n`;
  cmd += 'GAP 0,0\r\n';
  cmd += 'DIRECTION 1\r\n';
  cmd += 'REFERENCE 0,0\r\n';
  cmd += 'CLS\r\n';

  const sheetCount = physicalSheetsForBarcodeCount(total);

  for (let s = 0; s < sheetCount; s++) {
    if (s > 0) {
      cmd += 'CLS\r\n';
    }
    const start = s * barcodesPerLabel;
    const onThisSheet = Math.min(barcodesPerLabel, total - start);

    for (let i = 0; i < onThisSheet; i++) {
      /* Rotated 90°: bar length (height param) runs horizontally — center in column; symbol width runs vertically — center on label. */
      const x =
        left +
        i * colWidth +
        Math.max(0, Math.floor((colWidth - ean13BarHeightDots) / 2));
      const y = Math.max(16, Math.floor((heightDots - symbolSpanDots) / 2));

      const textPad = 8;
      const nameFull = sanitizeTsplQuotedString(`Name: ${labelText.name}`);
      const sizeFull = sanitizeTsplQuotedString(labelText.sizeLine);
      const hasSizeLine = Boolean(sizeFull.trim());
      const nameRows = segmentTsplTextForColumnWidth(nameFull, colWidth, textPad);
      const nameLineStep = 22;
      const nameToSizeLineGap = hasSizeLine ? 22 : 0;
      const gapSizeLineToBarcode = hasSizeLine ? 38 : 20;
      const textX = left + (i + 1) * colWidth - textPad;
      const tySize = Math.max(8, y - gapSizeLineToBarcode);
      const maxNameRows = Math.max(
        1,
        Math.min(
          40,
          Math.floor((tySize - nameToSizeLineGap - 8) / nameLineStep) + 1
        )
      );
      const nameRowsCapped = nameRows.slice(0, maxNameRows);
      const tsplFont = '2';
      const tsplMul = 1;
      const tsplAlignRight = 3;
      let tyName = hasSizeLine ? tySize - nameToSizeLineGap : tySize;
      for (let r = 0; r < nameRowsCapped.length; r++) {
        cmd += `TEXT ${textX},${tyName},"${tsplFont}",180,${tsplMul},${tsplMul},${tsplAlignRight},"${nameRowsCapped[r]}"\r\n`;
        tyName -= nameLineStep;
      }
      if (hasSizeLine) {
        cmd += `TEXT ${textX},${tySize},"${tsplFont}",180,${tsplMul},${tsplMul},${tsplAlignRight},"${sizeFull}"\r\n`;
      }

      cmd += `BARCODE ${x},${y},"EAN13",${ean13BarHeightDots},1,${ean13Rotation},${ean13NarrowDots},${ean13WideDots},"${ean}"\r\n`;
    }

    /* One PRINT = one physical sheet; labels 5+ use the next CLS + PRINT block. */
    cmd += 'PRINT 1,1\r\n';
  }

  return cmd;
};

// ---------------------------------------------------------------------------
// TSC thermal printer via WebUSB (Chrome / Edge, HTTPS or localhost only)
// Browser "Print" cannot send TSPL; this path sends raw commands to the USB device.
// ---------------------------------------------------------------------------

/** Minimal WebUSB surface (DOM lib may omit USB types in some TS setups). */
type UsbDeviceFilter = { vendorId: number; productId?: number };
type UsbDeviceLike = {
  opened: boolean;
  configuration: { configurationValue: number } | null;
  open: () => Promise<void>;
  selectConfiguration: (configurationValue: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: BufferSource) => Promise<{ status?: string }>;
  releaseInterface: (interfaceNumber: number) => Promise<void>;
  close: () => Promise<void>;
  vendorId: number;
};
type UsbNavigator = Navigator & {
  usb?: {
    getDevices: () => Promise<UsbDeviceLike[]>;
    requestDevice: (options: { filters: UsbDeviceFilter[] }) => Promise<UsbDeviceLike>;
  };
};

const TSC_USB_FILTERS: UsbDeviceFilter[] = [
  { vendorId: 0x0483 },
  { vendorId: 0x04b8 },
  { vendorId: 0x1664 },
];

function wantsWebUsbFirst(): boolean {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BARCODE_USE_WEBUSB === 'false') {
    return false;
  }
  return true;
}

async function getTscUsbDevice(): Promise<UsbDeviceLike> {
  const nav = navigator as UsbNavigator;
  const usb = nav.usb;
  if (!usb) {
    throw new Error('WEBUSB_UNSUPPORTED');
  }

  const existing = await usb.getDevices();
  const reuse = existing.find((d: UsbDeviceLike) =>
    TSC_USB_FILTERS.some((f) => f.vendorId === d.vendorId)
  );
  if (reuse) {
    return reuse;
  }

  return usb.requestDevice({ filters: TSC_USB_FILTERS });
}

/** Use USB descriptors so we hit the real bulk-OUT endpoint (guessing 1–4 often fails silently). */
function findBulkOutEndpoint(device: unknown): { iface: number; ep: number } | null {
  type Ep = { type?: string; direction?: string; endpointNumber?: number };
  type Iface = { interfaceNumber?: number; alternates?: Array<{ endpoints?: Ep[] }> };
  type Conf = { interfaces?: Iface[] };
  const conf = (device as { configuration?: Conf | null }).configuration;
  if (!conf?.interfaces?.length) return null;

  for (const iface of conf.interfaces) {
    const inum = iface.interfaceNumber ?? 0;
    for (const alt of iface.alternates ?? []) {
      for (const ep of alt.endpoints ?? []) {
        if (ep.type === 'bulk' && ep.direction === 'out' && typeof ep.endpointNumber === 'number') {
          return { iface: inum, ep: ep.endpointNumber };
        }
      }
    }
  }
  return null;
}

async function selectFirstConfiguration(device: UsbDeviceLike): Promise<void> {
  if (device.configuration !== null) return;

  const anyDev = device as UsbDeviceLike & {
    configurations?: Array<{ configurationValue: number }>;
  };
  const value =
    anyDev.configurations?.[0]?.configurationValue ??
    /* most TSC printers */ 1;

  await device.selectConfiguration(value);
}

async function openAndSendRaw(device: UsbDeviceLike, payload: Uint8Array): Promise<void> {
  if (device.opened === false) {
    await device.open();
  }

  await selectFirstConfiguration(device);

  const resolved = findBulkOutEndpoint(device);
  const chunkSize = 16384;

  if (resolved) {
    await device.claimInterface(resolved.iface);
    try {
      for (let offset = 0; offset < payload.length; offset += chunkSize) {
        const chunk = payload.subarray(offset, Math.min(offset + chunkSize, payload.length));
        const result = await device.transferOut(
          resolved.ep,
          chunk as unknown as BufferSource
        );
        const st = (result as { status?: string }).status;
        if (st && st !== 'ok') {
          throw new Error(`USB transfer status: ${st}`);
        }
      }
    } finally {
      try {
        await device.releaseInterface(resolved.iface);
      } catch {
        /* ignore */
      }
      try {
        await device.close();
      } catch {
        /* ignore */
      }
    }
    return;
  }

  /* Fallback: probe interfaces/endpoints (older path) */
  let iface: number | null = null;
  for (const n of [0, 1, 2]) {
    try {
      await device.claimInterface(n);
      iface = n;
      break;
    } catch {
      /* try next */
    }
  }
  if (iface === null) {
    try {
      await device.close();
    } catch {
      /* ignore */
    }
    throw new Error('Could not claim a USB interface on the printer.');
  }

  const tryEndpoints = [1, 2, 3, 4, 5, 6];
  let lastErr: Error | null = null;

  for (const ep of tryEndpoints) {
    try {
      for (let offset = 0; offset < payload.length; offset += chunkSize) {
        const chunk = payload.subarray(offset, Math.min(offset + chunkSize, payload.length));
        const result = await device.transferOut(ep, chunk as unknown as BufferSource);
        const st = (result as { status?: string }).status;
        if (st && st !== 'ok') {
          throw new Error(`USB transfer status: ${st}`);
        }
      }
      await device.releaseInterface(iface);
      await device.close();
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  try {
    await device.releaseInterface(iface);
  } catch {
    /* ignore */
  }
  try {
    await device.close();
  } catch {
    /* ignore */
  }

  throw lastErr ?? new Error('USB transferOut failed (no bulk OUT endpoint found).');
}

/**
 * Sends TSPL to the TSC printer over WebUSB.
 * User must pick the device once (Chrome remembers it afterward).
 */
export async function printBarcodeViaWebUsb(
  productId: string,
  totalBarcodes: number,
  labelText: BarcodeLabelPrintText
): Promise<void> {
  const n = Math.floor(totalBarcodes);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Print quantity must be a positive integer.');
  }
  const ean = convertToEAN13Format(productId);
  if (!/^\d{12}$/.test(ean)) {
    throw new Error(`Invalid EAN-13 format: ${ean}.`);
  }

  const commands = generateTSPLCommands(productId, n, labelText);
  const data = new TextEncoder().encode(commands);

  const device = await getTscUsbDevice();
  await openAndSendRaw(device, data);
}

/** Browser print — `totalBarcodes` = exact number of labels (matches initial inventory). */
const printViaBrowser = (
  productId: string,
  productName = '',
  totalBarcodes = 1,
  labelText: BarcodeLabelPrintText,
  existingWindow?: Window | null
) => {
  const { linerLeftIn, linerRightIn, barcodesPerLabel } = LABEL_LAYOUT;

  const sheetWidthMm = sheetWidthIn * 25.4;
  const sheetHeightMm = sheetHeightIn * 25.4;
  const padLRmm = (linerLeftIn + linerRightIn) * 25.4;
  const padTBmm = LABEL_LAYOUT.topBottomMarginIn * 25.4;
  const innerWidthMm = sheetWidthMm - padLRmm;
  const colWidthMm = innerWidthMm / barcodesPerLabel;

  const total = Math.max(0, Math.floor(totalBarcodes));
  const sheetCount = physicalSheetsForBarcodeCount(total);

  let html = '';

  for (let s = 0; s < sheetCount; s++) {
    const start = s * barcodesPerLabel;
    const onThisSheet = Math.min(barcodesPerLabel, total - start);
    let row = '';

    for (let j = 0; j < onThisSheet; j++) {
      const sizeLineHtml = labelText.sizeLine
        ? `<div class="meta-line meta-line--size">${escapeHtml(labelText.sizeLine)}</div>`
        : '';
      const metaRow = `
            <div class="barcode-meta-rotated" aria-label="Product label">
              <div class="barcode-meta-col">
                <div class="meta-line meta-line--name">${escapeHtml(`Name: ${labelText.name}`)}</div>
                ${sizeLineHtml}
              </div>
            </div>`;

      row += `
        <div class="barcode-item barcode-item--with-meta">
          <div class="barcode-label-stack">
            ${metaRow}
            <div class="barcode-symbol-wrap">
              <div class="barcode-rotate">
                ${generateBarcodeImage(productId)}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    html += `<div class="label-sheet"><div class="label">${row}</div></div>`;
  }

  const w = existingWindow ?? window.open('', '_blank');
  if (!w) {
    throw new Error('Could not open print window. Please check your popup blocker settings.');
  }

  w.document.open();
  w.document.write(`
  <html>
  <head>
  <title>Barcodes — ${escapeHtml(productName || productId)}</title>
  <style>
    @page {
      size: ${sheetWidthMm}mm ${sheetHeightMm}mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
    }

    /*
     * One .label-sheet = one printed page (max 4 barcodes in .label). Page breaks live on the outer
     * block so engines don’t merge flex rows onto a single sheet when quantity > 4.
     */
    .label-sheet {
      display: block;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .label-sheet + .label-sheet {
      page-break-before: always;
      break-before: page;
    }

    .label-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .label {
      width: ${sheetWidthMm}mm;
      height: ${sheetHeightMm}mm;
      min-height: ${sheetHeightMm}mm;
      max-height: ${sheetHeightMm}mm;
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      align-items: stretch;
      justify-content: flex-start;
      gap: 0;
      padding-left: ${linerLeftIn * 25.4}mm;
      padding-right: ${linerRightIn * 25.4}mm;
      padding-top: ${padTBmm}mm;
      padding-bottom: ${padTBmm}mm;
      box-sizing: border-box;
      background: #fff;
      overflow: visible;
    }

    @media print {
      .label-sheet {
        page-break-after: always;
        break-after: page;
      }
      .label-sheet + .label-sheet {
        page-break-before: always;
        break-before: page;
      }
      .label-sheet:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }

    .barcode-item {
      flex: 0 0 ${colWidthMm}mm;
      width: ${colWidthMm}mm;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
    }

    /* Name + size first; barcode stays centered in the remaining strip — SVG size unchanged. */
    .barcode-label-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: visible;
    }

    .barcode-item--with-meta .barcode-label-stack {
      gap: 0.5mm;
    }

    /* Slip-on tag style: name/size along the strip, rotated 180° from default upright */
    .barcode-meta-rotated {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 100%;
      overflow: visible;
    }

    .barcode-meta-col {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.22rem;
      width: 100%;
      max-width: min(178mm, 100%);
      font-size: 9.5pt;
      line-height: 1.15;
      color: #111;
      text-align: right;
      transform: rotate(-90deg) rotate(180deg);
      transform-origin: center center;
      overflow: visible;
    }

    .meta-line {
      width: 100%;
      max-width: none;
      text-align: right;
      overflow: visible;
    }

    .meta-line--name {
      white-space: normal;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .meta-line--size {
      white-space: nowrap;
    }

    .barcode-symbol-wrap {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 0;
    }

    .barcode-rotate {
      transform: rotate(90deg);
      transform-origin: center center;
    }

    .barcode-item svg {
      display: block;
      /* Nominal symbol width (regular retail); long axis runs along the 6″ strip after 90° rotation */
      width: ${STANDARD_BARCODE_WIDTH} !important;
      height: auto !important;
      max-width: none !important;
      max-height: none !important;
    }
  </style>
  </head>

  <body>
    ${html}

    <script>
      window.onload = () => {
        setTimeout(() => {
          window.print();
          window.onafterprint = () => window.close();
        }, 500);
      };
    </script>
  </body>
  </html>
  `);

  w.document.close();
};

/**
 * Main print — `quantity` = total barcodes to print (same as initial inventory count).
 * Each sticker prints **Name** and **size** (height + caliper) before the barcode; the barcode graphic size is unchanged.
 * Tries **WebUSB → TSC (TSPL)** first when supported; otherwise uses the browser print dialog.
 * Set `NEXT_PUBLIC_BARCODE_USE_WEBUSB=false` to always use browser print only.
 */
export const printBarcode = async (
  productId: string,
  productName = '',
  quantity = 1,
  existingWindow?: Window | null,
  labelExtras?: BarcodePrintLabelExtras
): Promise<void> => {
  if (!productId) {
    throw new Error('Product ID is required for barcode printing');
  }

  const n = Math.floor(quantity);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Print quantity must be a positive integer (same as inventory).');
  }

  const ean = convertToEAN13Format(productId);
  if (!/^\d{12}$/.test(ean)) {
    throw new Error(`Invalid EAN-13 format: ${ean}. Must be exactly 12 digits.`);
  }

  const labelText = buildLabelText(productName, labelExtras);

  const tryUsb = wantsWebUsbFirst() && typeof navigator !== 'undefined' && 'usb' in navigator;

  if (tryUsb) {
    try {
      await printBarcodeViaWebUsb(productId, n, labelText);
      existingWindow?.close();
      return;
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === 'NotFoundError') {
        /* User closed the device picker — fall back to browser print */
      } else if (err?.message === 'WEBUSB_UNSUPPORTED') {
        /* No WebUSB (e.g. Firefox, Safari) */
      } else if (err?.name === 'SecurityError') {
        console.warn('WebUSB blocked (use HTTPS or localhost):', e);
      } else {
        console.warn('TSC WebUSB print failed, falling back to browser print:', e);
      }
    }
  }

  printViaBrowser(productId, productName, n, labelText, existingWindow);
};
