import { PDFDocument, StandardFonts, rgb, degrees, PageSizes } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ProcessedFileResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  pageCount?: number;
  summary: string;
}

export function parsePageSelection(input: string, totalPages: number): number[] {
  const cleaned = input.trim();
  if (!cleaned) return Array.from({ length: totalPages }, (_, i) => i);
  const indices: number[] = [];
  const parts = cleaned.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [aStr, bStr] = trimmed.split('-');
      const a = Math.max(1, parseInt(aStr, 10));
      const b = Math.min(totalPages, parseInt(bStr, 10));
      if (!Number.isNaN(a) && !Number.isNaN(b) && a <= b) {
        for (let p = a; p <= b; p++) indices.push(p - 1);
      }
    } else {
      const p = parseInt(trimmed, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= totalPages) {
        indices.push(p - 1);
      }
    }
  }
  return indices;
}

export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function mergePdfsAndImages(files: File[]): Promise<ProcessedFileResult> {
  const outPdf = await PDFDocument.create();
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const copied = await outPdf.copyPages(src, src.getPageIndices());
      copied.forEach((p) => outPdf.addPage(p));
    } else if (file.type.startsWith('image/')) {
      const imgBytes = await file.arrayBuffer();
      let embedded;
      if (lower.endsWith('.png') || file.type === 'image/png') {
        embedded = await outPdf.embedPng(imgBytes);
      } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || file.type === 'image/jpeg') {
        embedded = await outPdf.embedJpg(imgBytes);
      } else {
        const jpgBlob = await rasterImageToJpegBlob(file);
        embedded = await outPdf.embedJpg(await jpgBlob.arrayBuffer());
      }
      const [a4w, a4h] = PageSizes.A4;
      const page = outPdf.addPage([a4w, a4h]);
      const margin = 24;
      const scale = Math.min((a4w - margin * 2) / embedded.width, (a4h - margin * 2) / embedded.height);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      page.drawImage(embedded, {
        x: (a4w - w) / 2,
        y: (a4h - h) / 2,
        width: w,
        height: h,
      });
    }
  }
  const saved = await outPdf.save({ useObjectStreams: true });
  const blob = new Blob([new Uint8Array(saved)], { type: 'application/pdf' });
  return {
    blob,
    filename: 'merged_document.pdf',
    mimeType: 'application/pdf',
    pageCount: outPdf.getPageCount(),
    summary: `Merged ${files.length} file(s) into ${outPdf.getPageCount()} pages.`,
  };
}

async function rasterImageToJpegBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image conversion failed'))), 'image/jpeg', 0.92);
  });
}

export async function splitPdf(
  file: File,
  mode: 'all' | 'range',
  rangeText: string
): Promise<ProcessedFileResult> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();

  if (mode === 'range') {
    const indices = parsePageSelection(rangeText, total);
    if (!indices.length) throw new Error(`Enter valid page numbers between 1 and ${total}.`);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    const saved = await out.save({ useObjectStreams: true });
    return {
      blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
      filename: `${file.name.replace(/\.pdf$/i, '')}_split.pdf`,
      mimeType: 'application/pdf',
      pageCount: out.getPageCount(),
      summary: `Extracted ${out.getPageCount()} page(s) from ${total}-page PDF.`,
    };
  }

  const zip = new JSZip();
  for (let i = 0; i < total; i++) {
    const single = await PDFDocument.create();
    const [p] = await single.copyPages(src, [i]);
    single.addPage(p);
    const saved = await single.save({ useObjectStreams: true });
    zip.file(`page_${String(i + 1).padStart(3, '0')}.pdf`, saved);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipBlob,
    filename: `${file.name.replace(/\.pdf$/i, '')}_pages.zip`,
    mimeType: 'application/zip',
    pageCount: total,
    summary: `Split all ${total} pages into individual PDFs inside ZIP archive.`,
  };
}

export async function compressPdf(
  file: File,
  level: 'low' | 'medium' | 'high'
): Promise<ProcessedFileResult> {
  const bytes = await file.arrayBuffer();
  if (level === 'low') {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const saved = await doc.save({ useObjectStreams: true });
    const blob = new Blob([new Uint8Array(saved)], { type: 'application/pdf' });
    return {
      blob,
      filename: `${file.name.replace(/\.pdf$/i, '')}_optimized.pdf`,
      mimeType: 'application/pdf',
      pageCount: doc.getPageCount(),
      summary: `Optimized PDF streams (${(file.size / 1024).toFixed(1)} KB → ${(blob.size / 1024).toFixed(1)} KB).`,
    };
  }

  // Medium/High: rasterize pages via pdfjs-dist and repack at tuned DPI & JPEG quality
  const scale = level === 'medium' ? 1.35 : 1.0;
  const quality = level === 'medium' ? 0.72 : 0.52;
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  const out = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const jpgBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Rasterize failed'))), 'image/jpeg', quality);
    });
    const jpgEmbed = await out.embedJpg(await jpgBlob.arrayBuffer());
    const origViewport = page.getViewport({ scale: 1 });
    const newPage = out.addPage([origViewport.width, origViewport.height]);
    newPage.drawImage(jpgEmbed, {
      x: 0,
      y: 0,
      width: origViewport.width,
      height: origViewport.height,
    });
  }

  const saved = await out.save({ useObjectStreams: true });
  const compressedBlob = new Blob([new Uint8Array(saved)], { type: 'application/pdf' });
  return {
    blob: compressedBlob,
    filename: `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`,
    mimeType: 'application/pdf',
    pageCount: pdf.numPages,
    summary: `Compressed ${pdf.numPages} page(s): ${(file.size / 1024).toFixed(1)} KB → ${(compressedBlob.size / 1024).toFixed(1)} KB.`,
  };
}

export async function rotatePdf(file: File, angle: 90 | 180 | 270): Promise<ProcessedFileResult> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  doc.getPages().forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  });
  const saved = await doc.save({ useObjectStreams: true });
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename: `${file.name.replace(/\.pdf$/i, '')}_rotated.pdf`,
    mimeType: 'application/pdf',
    pageCount: doc.getPageCount(),
    summary: `Rotated ${doc.getPageCount()} page(s) by ${angle}°.`,
  };
}

export async function editPdfPageOrder(
  file: File,
  mode: 'delete' | 'extract' | 'reorder',
  selectionText: string
): Promise<ProcessedFileResult> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const total = src.getPageCount();
  const parsed = parsePageSelection(selectionText, total);

  let targetIndices: number[] = [];
  if (mode === 'delete') {
    const toRemove = new Set(parsed);
    targetIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !toRemove.has(i));
  } else {
    targetIndices = parsed;
  }

  if (!targetIndices.length) {
    throw new Error('Resulting PDF would have zero pages. Check your page selection.');
  }

  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, targetIndices);
  copied.forEach((p) => out.addPage(p));
  const saved = await out.save({ useObjectStreams: true });
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename: `${file.name.replace(/\.pdf$/i, '')}_${mode}.pdf`,
    mimeType: 'application/pdf',
    pageCount: out.getPageCount(),
    summary: `Updated PDF now contains ${out.getPageCount()} page(s).`,
  };
}

export async function addPageNumbersToPdf(
  file: File,
  position: 'bottom-center' | 'bottom-right' | 'top-right'
): Promise<ProcessedFileResult> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const label = `Page ${idx + 1} of ${total}`;
    const fontSize = 10;
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const x =
      position === 'bottom-center'
        ? (width - textWidth) / 2
        : width - textWidth - 28;
    const y = position === 'top-right' ? height - 24 : 18;
    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
  });

  const saved = await doc.save({ useObjectStreams: true });
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename: `${file.name.replace(/\.pdf$/i, '')}_numbered.pdf`,
    mimeType: 'application/pdf',
    pageCount: total,
    summary: `Added page numbers to all ${total} pages.`,
  };
}

export async function addWatermarkToPdf(
  file: File,
  text: string,
  opacity = 0.22
): Promise<ProcessedFileResult> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const watermarkText = text.trim() || 'CONFIDENTIAL';

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const size = Math.max(24, Math.min(54, width / 10));
    page.drawText(watermarkText, {
      x: width * 0.18,
      y: height * 0.42,
      size,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity,
      rotate: degrees(35),
    });
  });

  const saved = await doc.save({ useObjectStreams: true });
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename: `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`,
    mimeType: 'application/pdf',
    pageCount: pages.length,
    summary: `Applied "${watermarkText}" watermark across ${pages.length} page(s).`,
  };
}

export async function pdfToImages(
  file: File,
  mimeType: 'image/jpeg' | 'image/png',
  scale = 2
): Promise<{
  previews: { url: string; name: string; sizeKb: number }[];
  downloadBlob: Blob;
  downloadName: string;
}> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const previews: { url: string; name: string; sizeKb: number }[] = [];
  const blobs: { name: string; blob: Blob }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Page render failed'))), mimeType, 0.92);
    });
    const name = `page_${String(i).padStart(2, '0')}.${ext}`;
    blobs.push({ name, blob });
    previews.push({ url: URL.createObjectURL(blob), name, sizeKb: Math.round(blob.size / 1024) });
  }

  if (blobs.length === 1) {
    return {
      previews,
      downloadBlob: blobs[0].blob,
      downloadName: `${file.name.replace(/\.pdf$/i, '')}.${ext}`,
    };
  }

  const zip = new JSZip();
  for (const item of blobs) {
    zip.file(item.name, item.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    previews,
    downloadBlob: zipBlob,
    downloadName: `${file.name.replace(/\.pdf$/i, '')}_images.zip`,
  };
}

export async function extractTextFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const chunks: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of content.items) {
      if ('str' in item) {
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = item.str;
        } else {
          currentLine += (currentLine ? ' ' : '') + item.str;
        }
        lastY = y;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    chunks.push(`--- Page ${i} ---\n${lines.join('\n')}`);
  }

  return { text: chunks.join('\n\n'), pageCount: pdf.numPages };
}

export async function pdfToWordDoc(file: File): Promise<ProcessedFileResult> {
  const { text, pageCount } = await extractTextFromPdf(file);
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map((line) => `<p style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin: 4pt 0;">${line || '&nbsp;'}</p>`)
    .join('\n');

  const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${file.name}</title></head><body>${escaped}</body></html>`;
  const blob = new Blob([docHtml], { type: 'application/msword' });
  return {
    blob,
    filename: `${file.name.replace(/\.pdf$/i, '')}.doc`,
    mimeType: 'application/msword',
    pageCount,
    summary: `Extracted ${pageCount} page(s) into Word-editable .doc file.`,
  };
}

export async function textOrDocxToPdf(fileOrText: File | string): Promise<ProcessedFileResult> {
  let rawText = '';
  let baseName = 'document';

  if (typeof fileOrText === 'string') {
    rawText = fileOrText;
  } else {
    baseName = fileOrText.name.replace(/\.[^.]+$/, '');
    const lower = fileOrText.name.toLowerCase();
    if (lower.endsWith('.docx')) {
      const zip = await JSZip.loadAsync(await fileOrText.arrayBuffer());
      const docXml = await zip.file('word/document.xml')?.async('string');
      if (!docXml) throw new Error('Could not find word/document.xml inside DOCX.');
      rawText = docXml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n /g, '\n')
        .trim();
    } else if (lower.endsWith('.pptx')) {
      const zip = await JSZip.loadAsync(await fileOrText.arrayBuffer());
      const slideFiles = Object.keys(zip.files)
        .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
        .sort();
      const parts: string[] = [];
      for (const sf of slideFiles) {
        const xml = await zip.file(sf)!.async('string');
        const txt = xml.replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        parts.push(`[${sf.split('/').pop()?.replace('.xml', '').toUpperCase()}]\n${txt}`);
      }
      rawText = parts.join('\n\n') || 'Empty presentation';
    } else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      const html = await fileOrText.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      rawText = doc.body?.innerText || doc.body?.textContent || html;
    } else {
      rawText = await fileOrText.text();
    }
  }

  return await createPaginatedTextPdf(rawText, `${baseName}.pdf`);
}

export async function createPaginatedTextPdf(
  text: string,
  filename = 'document.pdf',
  title?: string
): Promise<ProcessedFileResult> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const [pageW, pageH] = PageSizes.A4;
  const margin = 48;
  const fontSize = 11;
  const lineHeight = 16;
  const maxWidth = pageW - margin * 2;

  const safeText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  const paragraphs = safeText.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
  }

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  if (title) {
    page.drawText(title.replace(/[^\x20-\x7E]/g, ' '), {
      x: margin,
      y,
      size: 15,
      font: bold,
      color: rgb(0.14, 0.14, 0.14),
    });
    y -= 26;
  }

  for (const line of lines) {
    if (y < margin + 16) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    if (line) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
    }
    y -= lineHeight;
  }

  const saved = await pdfDoc.save({ useObjectStreams: true });
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename,
    mimeType: 'application/pdf',
    pageCount: pdfDoc.getPageCount(),
    summary: `Generated ${pdfDoc.getPageCount()}-page A4 PDF (${lines.length} lines).`,
  };
}

export async function pdfToExcel(file: File): Promise<ProcessedFileResult> {
  const { text, pageCount } = await extractTextFromPdf(file);
  const rows = text
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('--- Page'))
    .map((line) => line.split(/\s{2,}|\t|\|/).map((cell) => cell.trim()));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['No extractable text found']]);
  XLSX.utils.book_append_sheet(wb, ws, 'ExtractedData');
  const outBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([outBuf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return {
    blob,
    filename: `${file.name.replace(/\.pdf$/i, '')}.xlsx`,
    mimeType: blob.type,
    pageCount,
    summary: `Exported ${rows.length} rows from ${pageCount} PDF page(s) to Excel.`,
  };
}

export async function excelToPdf(file: File): Promise<ProcessedFileResult> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1 });
  const textLines = rows.map((r) => (Array.isArray(r) ? r.join('  |  ') : String(r)));
  return await createPaginatedTextPdf(
    textLines.join('\n'),
    `${file.name.replace(/\.[^.]+$/, '')}.pdf`,
    `Spreadsheet: ${sheetName}`
  );
}

export async function createEncryptedPdfVault(
  file: File,
  password: string
): Promise<ProcessedFileResult> {
  if (password.length < 4) throw new Error('Password must be at least 4 characters.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, bytes)
  );

  const toB64 = (arr: Uint8Array) => {
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  };

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Protected PDF – ${file.name}</title><style>body{font-family:system-ui,sans-serif;background:#FAFAF7;color:#252525;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}main{background:#fff;border:1px solid #EAEAEA;border-radius:12px;padding:32px;max-width:420px;width:90%}input,button{width:100%;padding:10px 12px;border-radius:8px;margin-top:10px;box-sizing:border-box}input{border:1px solid #ccc}button{background:#F5C542;border:0;font-weight:700;cursor:pointer}#err{color:#dc2626;font-size:13px;margin-top:8px}</style></head><body><main><h2>Protected PDF Vault</h2><p>Enter password to decrypt and open <strong>${file.name.replace(/</g, '&lt;')}</strong> locally in your browser.</p><input id="pw" type="password" placeholder="Enter password" /><button onclick="unlock()">Decrypt & Download PDF</button><div id="err"></div></main><script>
const S="${toB64(salt)}",I="${toB64(iv)}",D="${toB64(cipher)}",N=${JSON.stringify(file.name)};
function b64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
async function unlock(){document.getElementById('err').textContent='';try{const p=document.getElementById('pw').value;const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveKey']);const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(S),iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt']);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(I)},k,b64(D));const u=URL.createObjectURL(new Blob([pt],{type:'application/pdf'}));const a=document.createElement('a');a.href=u;a.download=N;a.click();}catch(e){document.getElementById('err').textContent='Incorrect password.';}}
</script></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  return {
    blob,
    filename: `${file.name.replace(/\.pdf$/i, '')}_protected.html`,
    mimeType: 'text/html',
    summary: 'Encrypted PDF using AES-256-GCM into an offline password-locked HTML vault.',
  };
}

export async function printLayoutPdf(
  file: File,
  layout: 'a4-to-a3' | 'nup' | 'booklet' | 'optimize',
  nUp: 2 | 4 = 2
): Promise<ProcessedFileResult> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const srcPages = src.getPages();

  if (layout === 'a4-to-a3') {
    const [a3w, a3h] = PageSizes.A3;
    const embeddedPages = await out.embedPages(srcPages);
    for (const ep of embeddedPages) {
      const page = out.addPage([a3w, a3h]);
      const scale = Math.min(a3w / ep.width, a3h / ep.height);
      page.drawPage(ep, {
        x: (a3w - ep.width * scale) / 2,
        y: (a3h - ep.height * scale) / 2,
        width: ep.width * scale,
        height: ep.height * scale,
      });
    }
    const saved = await out.save({ useObjectStreams: true });
    return {
      blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
      filename: `${file.name.replace(/\.pdf$/i, '')}_A3.pdf`,
      mimeType: 'application/pdf',
      pageCount: out.getPageCount(),
      summary: `Scaled ${srcPages.length} page(s) to A3 print format.`,
    };
  }

  if (layout === 'optimize') {
    const [a4w, a4h] = PageSizes.A4;
    const embeddedPages = await out.embedPages(srcPages);
    const margin = 18;
    for (const ep of embeddedPages) {
      const page = out.addPage([a4w, a4h]);
      const scale = Math.min((a4w - margin * 2) / ep.width, (a4h - margin * 2) / ep.height);
      page.drawPage(ep, {
        x: (a4w - ep.width * scale) / 2,
        y: (a4h - ep.height * scale) / 2,
        width: ep.width * scale,
        height: ep.height * scale,
      });
    }
    const saved = await out.save({ useObjectStreams: true });
    return {
      blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
      filename: `${file.name.replace(/\.pdf$/i, '')}_print_ready.pdf`,
      mimeType: 'application/pdf',
      pageCount: out.getPageCount(),
      summary: `Standardized ${srcPages.length} page(s) to uniform A4 print margins.`,
    };
  }

  // N-Up or Booklet imposition onto landscape A4
  const [a4h, a4w] = PageSizes.A4; // Landscape A4: 841.89 x 595.28
  const sheetW = a4w;
  const sheetH = a4h;

  let orderedIndices = srcPages.map((_, i) => i);
  if (layout === 'booklet') {
    const padded = Math.ceil(orderedIndices.length / 4) * 4;
    const seq: number[] = [];
    let left = 0;
    let right = padded - 1;
    while (left < right) {
      seq.push(right, left, left + 1, right - 1);
      left += 2;
      right -= 2;
    }
    orderedIndices = seq;
  }

  const perSheet = layout === 'booklet' ? 2 : nUp;
  const cols = 2;
  const rows = perSheet === 4 ? 2 : 1;
  const embedded = await out.embedPages(srcPages);

  for (let i = 0; i < orderedIndices.length; i += perSheet) {
    const sheet = out.addPage([sheetW, sheetH]);
    const cellW = sheetW / cols;
    const cellH = sheetH / rows;
    for (let slot = 0; slot < perSheet; slot++) {
      const idx = orderedIndices[i + slot];
      if (idx === undefined || idx >= embedded.length) continue;
      const ep = embedded[idx];
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const pad = 10;
      const scale = Math.min((cellW - pad * 2) / ep.width, (cellH - pad * 2) / ep.height);
      const drawW = ep.width * scale;
      const drawH = ep.height * scale;
      const x = col * cellW + (cellW - drawW) / 2;
      const y = sheetH - (row + 1) * cellH + (cellH - drawH) / 2;
      sheet.drawPage(ep, { x, y, width: drawW, height: drawH });
    }
  }

  const saved = await out.save({ useObjectStreams: true });
  return {
    blob: new Blob([new Uint8Array(saved)], { type: 'application/pdf' }),
    filename: `${file.name.replace(/\.pdf$/i, '')}_${layout}.pdf`,
    mimeType: 'application/pdf',
    pageCount: out.getPageCount(),
    summary: `Imposed ${srcPages.length} pages onto ${out.getPageCount()} ${layout} print sheet(s).`,
  };
}
