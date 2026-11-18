import Tesseract from 'tesseract.js';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export async function runImageOcr(
  file: File,
  lang: 'eng' | 'hin' | 'guj',
  onProgress?: (pct: number) => void
): Promise<string> {
  const result = await Tesseract.recognize(file, lang, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  return result.data.text || '';
}

export async function createZipArchive(
  files: File[],
  renamePattern?: string
): Promise<{ blob: Blob; filename: string; count: number }> {
  const zip = new JSZip();
  files.forEach((f, idx) => {
    let targetName = f.name;
    if (renamePattern && renamePattern.trim()) {
      const ext = f.name.includes('.') ? f.name.split('.').pop() : 'bin';
      targetName = `${renamePattern.trim()}_${String(idx + 1).padStart(2, '0')}.${ext}`;
    }
    zip.file(targetName, f);
  });
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, filename: 'archive_bundle.zip', count: files.length };
}

export async function extractZipArchive(
  file: File
): Promise<Array<{ name: string; size: number; blob: Blob }>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const extracted: Array<{ name: string; size: number; blob: Blob }> = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const blob = await entry.async('blob');
    extracted.push({ name, size: blob.size, blob });
  }
  return extracted;
}

export async function convertTabularData(
  fileOrText: File | string,
  target: 'xlsx' | 'csv' | 'json'
): Promise<{ blob: Blob; filename: string; previewText: string }> {
  let wb: XLSX.WorkBook;
  let baseName = 'converted_data';

  if (typeof fileOrText === 'string') {
    const parsed = JSON.parse(fileOrText);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(arr);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
  } else {
    baseName = fileOrText.name.replace(/\.[^.]+$/, '');
    if (fileOrText.name.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(await fileOrText.text());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(arr);
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
    } else {
      wb = XLSX.read(await fileOrText.arrayBuffer(), { type: 'array' });
    }
  }

  const firstSheet = wb.Sheets[wb.SheetNames[0]];

  if (target === 'xlsx') {
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return {
      blob,
      filename: `${baseName}.xlsx`,
      previewText: XLSX.utils.sheet_to_csv(firstSheet).slice(0, 1200),
    };
  }

  if (target === 'json') {
    const json = JSON.stringify(XLSX.utils.sheet_to_json(firstSheet), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    return { blob, filename: `${baseName}.json`, previewText: json.slice(0, 1500) };
  }

  const csv = XLSX.utils.sheet_to_csv(firstSheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  return { blob, filename: `${baseName}.csv`, previewText: csv.slice(0, 1500) };
}

export function cleanAndTransformText(
  text: string,
  action: 'upper' | 'lower' | 'title' | 'sentence' | 'dedupe' | 'trim-spaces' | 'strip-html'
): string {
  switch (action) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return text.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
    case 'sentence':
      return text
        .toLowerCase()
        .replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
    case 'dedupe':
      return Array.from(new Set(text.split(/\r?\n/).map((l) => l.trim()))).join('\n');
    case 'strip-html':
      return text.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
    case 'trim-spaces':
    default:
      return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
  }
}

export async function compressBrowserMedia(
  file: File,
  kind: 'audio' | 'video'
): Promise<{ blob: Blob; filename: string; summary: string }> {
  // Real browser re-encoding using MediaRecorder / AudioContext where supported
  if (kind === 'audio') {
    const arrayBuf = await file.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(arrayBuf);

    // Downsample to mono 22050 Hz WAV for reliable size reduction on uncompressed WAV/long recordings
    const targetRate = 22050;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const wavBlob = encodeMonoWav(rendered);
    await ctx.close();
    return {
      blob: wavBlob,
      filename: `${file.name.replace(/\.[^.]+$/, '')}_compressed.wav`,
      summary: `Resampled audio to 22.05 kHz mono (${(file.size / 1024).toFixed(1)} KB → ${(wavBlob.size / 1024).toFixed(1)} KB).`,
    };
  }

  // Video compression via HTMLVideoElement + Canvas + MediaRecorder (WebM VP8)
  return await new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const scale = video.videoWidth > 720 ? 720 / video.videoWidth : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext('2d')!;
      const stream = canvas.captureStream(24);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const outBlob = new Blob(chunks, { type: 'video/webm' });
        resolve({
          blob: outBlob,
          filename: `${file.name.replace(/\.[^.]+$/, '')}_compressed.webm`,
          summary: `Re-encoded to ${canvas.width}×${canvas.height} WebM (${(file.size / 1024).toFixed(1)} KB → ${(outBlob.size / 1024).toFixed(1)} KB).`,
        });
      };

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };
      recorder.start(250);
      video.play().then(drawFrame).catch((err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unsupported browser video codec.'));
    };
  });
}

function encodeMonoWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const dataLen = samples.length * 2;
  const out = new ArrayBuffer(44 + dataLen);
  const view = new DataView(out);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}
