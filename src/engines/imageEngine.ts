import { PDFDocument, PageSizes } from 'pdf-lib';

export interface ImageProcessResult {
  blob: Blob;
  url: string;
  filename: string;
  width: number;
  height: number;
  sizeKb: number;
  summary: string;
}

async function loadImageToCanvas(
  file: File
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      mime,
      quality
    );
  });
}

export async function compressImage(
  file: File,
  qualityPct: number,
  maxWidthPx: number,
  targetMime: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<ImageProcessResult> {
  const { canvas: src, width, height } = await loadImageToCanvas(file);
  const scale = maxWidthPx > 0 && width > maxWidthPx ? maxWidthPx / width : 1;
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d')!;
  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(src, 0, 0, outW, outH);

  const blob = await canvasToBlob(out, targetMime, Math.max(0.05, Math.min(1, qualityPct / 100)));
  const ext = targetMime === 'image/png' ? 'png' : targetMime === 'image/webp' ? 'webp' : 'jpg';
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_compressed.${ext}`,
    width: outW,
    height: outH,
    sizeKb: Number((blob.size / 1024).toFixed(1)),
    summary: `${(file.size / 1024).toFixed(1)} KB → ${(blob.size / 1024).toFixed(1)} KB (${outW}×${outH}px)`,
  };
}

export async function compressToExactKb(
  file: File,
  targetKb: number,
  maxWidth = 1200
): Promise<ImageProcessResult> {
  const { canvas: src, width, height } = await loadImageToCanvas(file);
  const targetBytes = Math.max(4, targetKb) * 1024;
  let scale = width > maxWidth ? maxWidth / width : 1;

  let bestBlob: Blob | null = null;
  let bestW = width;
  let bestH = height;

  for (let pass = 0; pass < 4; pass++) {
    const w = Math.max(40, Math.round(width * scale));
    const h = Math.max(40, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);

    let lo = 0.08;
    let hi = 0.96;
    for (let iter = 0; iter < 8; iter++) {
      const mid = (lo + hi) / 2;
      const b = await canvasToBlob(canvas, 'image/jpeg', mid);
      if (b.size <= targetBytes) {
        bestBlob = b;
        bestW = w;
        bestH = h;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    if (bestBlob) break;
    scale *= 0.72;
  }

  if (!bestBlob) {
    const fallback = document.createElement('canvas');
    fallback.width = Math.max(40, Math.round(width * 0.4));
    fallback.height = Math.max(40, Math.round(height * 0.4));
    const ctx = fallback.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, fallback.width, fallback.height);
    ctx.drawImage(src, 0, 0, fallback.width, fallback.height);
    bestBlob = await canvasToBlob(fallback, 'image/jpeg', 0.25);
    bestW = fallback.width;
    bestH = fallback.height;
  }

  return {
    blob: bestBlob,
    url: URL.createObjectURL(bestBlob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_${targetKb}kb.jpg`,
    width: bestW,
    height: bestH,
    sizeKb: Number((bestBlob.size / 1024).toFixed(1)),
    summary: `Target ≤ ${targetKb} KB achieved: ${(bestBlob.size / 1024).toFixed(1)} KB (${bestW}×${bestH}px)`,
  };
}

export async function resizeImageExact(
  file: File,
  targetW: number,
  targetH: number,
  targetMime: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<ImageProcessResult> {
  const { canvas: src } = await loadImageToCanvas(file);
  const out = document.createElement('canvas');
  out.width = Math.max(10, targetW);
  out.height = Math.max(10, targetH);
  const ctx = out.getContext('2d')!;
  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, out.width, out.height);
  const blob = await canvasToBlob(out, targetMime, 0.94);
  const ext = targetMime === 'image/png' ? 'png' : 'jpg';
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_${out.width}x${out.height}.${ext}`,
    width: out.width,
    height: out.height,
    sizeKb: Number((blob.size / 1024).toFixed(1)),
    summary: `Resized to exact ${out.width}×${out.height} px (${(blob.size / 1024).toFixed(1)} KB).`,
  };
}

export async function cropImageAspect(
  file: File,
  aspectW: number,
  aspectH: number,
  zoom = 1,
  offsetX = 0,
  offsetY = 0
): Promise<ImageProcessResult> {
  const { canvas: src, width, height } = await loadImageToCanvas(file);
  const targetRatio = aspectW / aspectH;
  let cropW = width;
  let cropH = width / targetRatio;
  if (cropH > height) {
    cropH = height;
    cropW = height * targetRatio;
  }
  cropW = cropW / Math.max(1, zoom);
  cropH = cropH / Math.max(1, zoom);

  const sx = Math.max(0, Math.min(width - cropW, (width - cropW) / 2 + offsetX * (width * 0.25)));
  const sy = Math.max(0, Math.min(height - cropH, (height - cropH) / 2 + offsetY * (height * 0.25)));

  const out = document.createElement('canvas');
  out.width = Math.round(cropW);
  out.height = Math.round(cropH);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, sx, sy, cropW, cropH, 0, 0, out.width, out.height);
  const blob = await canvasToBlob(out, 'image/jpeg', 0.95);
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_cropped.jpg`,
    width: out.width,
    height: out.height,
    sizeKb: Number((blob.size / 1024).toFixed(1)),
    summary: `Cropped to ${out.width}×${out.height} px (${aspectW}:${aspectH} ratio).`,
  };
}

export async function removePhotoBackground(
  file: File,
  tolerance = 42,
  bgHex: 'transparent' | '#FFFFFF' | '#DCEBFF' = '#FFFFFF'
): Promise<ImageProcessResult> {
  const { canvas, ctx, width, height } = await loadImageToCanvas(file);
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;

  // Sample average corner pixels to estimate backdrop color
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let rAvg = 0, gAvg = 0, bAvg = 0;
  for (const idx of corners) {
    rAvg += d[idx];
    gAvg += d[idx + 1];
    bAvg += d[idx + 2];
  }
  rAvg /= 4;
  gAvg /= 4;
  bAvg /= 4;

  const fillRgb =
    bgHex === '#FFFFFF' ? [255, 255, 255] : bgHex === '#DCEBFF' ? [220, 235, 255] : null;

  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - rAvg;
    const dg = d[i + 1] - gAvg;
    const db = d[i + 2] - bAvg;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < tolerance) {
      if (fillRgb) {
        d[i] = fillRgb[0];
        d[i + 1] = fillRgb[1];
        d[i + 2] = fillRgb[2];
        d[i + 3] = 255;
      } else {
        d[i + 3] = 0;
      }
    } else if (dist < tolerance + 16) {
      const alphaFactor = (dist - tolerance) / 16;
      if (fillRgb) {
        d[i] = Math.round(fillRgb[0] * (1 - alphaFactor) + d[i] * alphaFactor);
        d[i + 1] = Math.round(fillRgb[1] * (1 - alphaFactor) + d[i + 1] * alphaFactor);
        d[i + 2] = Math.round(fillRgb[2] * (1 - alphaFactor) + d[i + 2] * alphaFactor);
      } else {
        d[i + 3] = Math.round(255 * alphaFactor);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const mime = bgHex === 'transparent' ? 'image/png' : 'image/jpeg';
  const ext = bgHex === 'transparent' ? 'png' : 'jpg';
  const blob = await canvasToBlob(canvas, mime, 0.94);
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_bg_clean.${ext}`,
    width,
    height,
    sizeKb: Number((blob.size / 1024).toFixed(1)),
    summary: `Replaced backdrop (${bgHex}) with tolerance ${tolerance}.`,
  };
}

export async function enhanceOrScanImage(
  file: File,
  options: {
    brightness: number; // -50..50
    contrast: number; // -50..50
    grayscale?: boolean;
    bwThreshold?: number; // 0 = off, else 80..200
  }
): Promise<ImageProcessResult> {
  const { canvas, ctx, width, height } = await loadImageToCanvas(file);
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;

  const bOffset = options.brightness * 2.2;
  const cFactor = (259 * (options.contrast * 2.2 + 255)) / (255 * (259 - options.contrast * 2.2));

  for (let i = 0; i < d.length; i += 4) {
    let r = cFactor * (d[i] + bOffset - 128) + 128;
    let g = cFactor * (d[i + 1] + bOffset - 128) + 128;
    let b = cFactor * (d[i + 2] + bOffset - 128) + 128;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    if (options.grayscale || (options.bwThreshold && options.bwThreshold > 0)) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (options.bwThreshold && options.bwThreshold > 0) {
        const val = lum > options.bwThreshold ? 255 : Math.max(0, lum * 0.45);
        r = g = b = val;
      } else {
        r = g = b = lum;
      }
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_enhanced.jpg`,
    width,
    height,
    sizeKb: Number((blob.size / 1024).toFixed(1)),
    summary: `Enhanced image (${width}×${height} px, ${(blob.size / 1024).toFixed(1)} KB).`,
  };
}

export async function whitenSignatureImage(
  file: File,
  threshold = 175
): Promise<ImageProcessResult> {
  const { canvas, ctx, width, height } = await loadImageToCanvas(file);
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum >= threshold) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    } else {
      const darkFactor = Math.max(0, lum / threshold);
      d[i] = Math.round(d[i] * darkFactor * 0.55);
      d[i + 1] = Math.round(d[i + 1] * darkFactor * 0.55);
      d[i + 2] = Math.round(d[i + 2] * darkFactor * 0.55);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_signature_clean.jpg`,
    width,
    height,
    sizeKb: Number((blob.size / 1024).toFixed(1)),
    summary: `Signature cleaned onto pure white background (${width}×${height} px).`,
  };
}

// Binary JFIF DPI writer for JPEG files
export async function setJpegDpi(file: File, dpi: number): Promise<ImageProcessResult> {
  const { canvas, width, height } = await loadImageToCanvas(file);
  const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
  const buf = new Uint8Array(await jpgBlob.arrayBuffer());

  // Standard canvas JPEG begins with FF D8 FF E0 .. "JFIF\0" (bytes 6..10)
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff && buf[3] === 0xe0) {
    buf[13] = 1; // units = pixels per inch
    buf[14] = (dpi >> 8) & 0xff;
    buf[15] = dpi & 0xff;
    buf[16] = (dpi >> 8) & 0xff;
    buf[17] = dpi & 0xff;
  }

  const outBlob = new Blob([buf], { type: 'image/jpeg' });
  return {
    blob: outBlob,
    url: URL.createObjectURL(outBlob),
    filename: `${file.name.replace(/\.[^.]+$/, '')}_${dpi}dpi.jpg`,
    width,
    height,
    sizeKb: Number((outBlob.size / 1024).toFixed(1)),
    summary: `Embedded ${dpi} DPI JFIF header into JPEG (${width}×${height} px).`,
  };
}

export async function generatePassportPhotoAndSheet(
  file: File,
  preset: 'in-passport' | 'pan-card' | 'us-visa' | 'stamp',
  sheetType: 'single' | '4x6' | 'a4',
  border = true
): Promise<{
  single: ImageProcessResult;
  sheet: ImageProcessResult;
  pdfBlob: Blob;
}> {
  // 300 DPI pixel sizes
  const dimensions: Record<typeof preset, { w: number; h: number; label: string }> = {
    'in-passport': { w: 413, h: 531, label: '35x45mm' },
    'pan-card': { w: 295, h: 413, label: '25x35mm' },
    'us-visa': { w: 600, h: 600, label: '2x2in' },
    stamp: { w: 236, h: 295, label: '20x25mm' },
  };
  const dim = dimensions[preset];

  const { canvas: src, width, height } = await loadImageToCanvas(file);
  const singleCanvas = document.createElement('canvas');
  singleCanvas.width = dim.w;
  singleCanvas.height = dim.h;
  const sCtx = singleCanvas.getContext('2d')!;
  sCtx.fillStyle = '#FFFFFF';
  sCtx.fillRect(0, 0, dim.w, dim.h);

  const srcRatio = width / height;
  const dstRatio = dim.w / dim.h;
  let sx = 0, sy = 0, sw = width, sh = height;
  if (srcRatio > dstRatio) {
    sw = height * dstRatio;
    sx = (width - sw) / 2;
  } else {
    sh = width / dstRatio;
    sy = (height - sh) / 3;
  }
  sCtx.drawImage(src, sx, sy, sw, sh, 0, 0, dim.w, dim.h);
  if (border) {
    sCtx.strokeStyle = '#333333';
    sCtx.lineWidth = 2;
    sCtx.strokeRect(1, 1, dim.w - 2, dim.h - 2);
  }

  const singleBlob = await canvasToBlob(singleCanvas, 'image/jpeg', 0.95);
  const single: ImageProcessResult = {
    blob: singleBlob,
    url: URL.createObjectURL(singleBlob),
    filename: `passport_single_${dim.label}.jpg`,
    width: dim.w,
    height: dim.h,
    sizeKb: Number((singleBlob.size / 1024).toFixed(1)),
    summary: `Single ${dim.label} photo (${dim.w}×${dim.h} px at 300 DPI).`,
  };

  // Sheet dimensions at 300 DPI: 4x6 = 1800x1200 landscape, A4 = 2480x3508
  const sheetW = sheetType === 'a4' ? 2480 : 1800;
  const sheetH = sheetType === 'a4' ? 3508 : 1200;
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = sheetW;
  sheetCanvas.height = sheetH;
  const shCtx = sheetCanvas.getContext('2d')!;
  shCtx.fillStyle = '#FFFFFF';
  shCtx.fillRect(0, 0, sheetW, sheetH);

  const gap = 28;
  const margin = 45;
  const cols = Math.max(1, Math.floor((sheetW - margin * 2 + gap) / (dim.w + gap)));
  const rows = Math.max(1, Math.floor((sheetH - margin * 2 + gap) / (dim.h + gap)));
  const startX = Math.round((sheetW - (cols * dim.w + (cols - 1) * gap)) / 2);
  const startY = Math.round((sheetH - (rows * dim.h + (rows - 1) * gap)) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (dim.w + gap);
      const y = startY + r * (dim.h + gap);
      shCtx.drawImage(singleCanvas, x, y);
    }
  }

  const sheetBlob = await canvasToBlob(sheetCanvas, 'image/jpeg', 0.94);
  const sheet: ImageProcessResult = {
    blob: sheetBlob,
    url: URL.createObjectURL(sheetBlob),
    filename: `passport_sheet_${sheetType}_${cols * rows}up.jpg`,
    width: sheetW,
    height: sheetH,
    sizeKb: Number((sheetBlob.size / 1024).toFixed(1)),
    summary: `Tiled ${cols * rows} photos (${cols}×${rows}) onto ${sheetType.toUpperCase()} sheet.`,
  };

  // Also create PDF print sheet
  const pdf = await PDFDocument.create();
  const pageDims = sheetType === 'a4' ? PageSizes.A4 : [432, 288] as [number, number];
  const page = pdf.addPage(pageDims);
  const embedded = await pdf.embedJpg(await sheetBlob.arrayBuffer());
  page.drawImage(embedded, { x: 0, y: 0, width: pageDims[0], height: pageDims[1] });
  const pdfBytes = await pdf.save();
  const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });

  return { single, sheet, pdfBlob };
}

export async function inspectImageForPortals(file: File): Promise<{
  width: number;
  height: number;
  sizeKb: number;
  mime: string;
  checks: { portal: string; pass: boolean; detail: string }[];
}> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();
  const sizeKb = Number((file.size / 1024).toFixed(1));

  const checks = [
    {
      portal: 'NSDL / UTI PAN Photo (213×213 px, <30 KB)',
      pass: sizeKb <= 30 && Math.abs(width - height) <= 20 && width >= 200,
      detail: `Current: ${width}×${height} px, ${sizeKb} KB`,
    },
    {
      portal: 'SSC / IBPS Photo (20–50 KB, Portrait)',
      pass: sizeKb >= 18 && sizeKb <= 50 && height >= width,
      detail: `Current: ${width}×${height} px, ${sizeKb} KB`,
    },
    {
      portal: 'Signature Standard (10–20 KB, Landscape)',
      pass: sizeKb >= 8 && sizeKb <= 20 && width > height,
      detail: `Current: ${width}×${height} px, ${sizeKb} KB`,
    },
    {
      portal: 'UPSC Photo (20–300 KB, ≥350×350 px)',
      pass: sizeKb >= 20 && sizeKb <= 300 && width >= 350 && height >= 350,
      detail: `Current: ${width}×${height} px, ${sizeKb} KB`,
    },
  ];

  return { width, height, sizeKb, mime: file.type || 'image/jpeg', checks };
}
