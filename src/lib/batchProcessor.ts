import JSZip from 'jszip';
import type { ToolDefinition, ToolEngineId } from '../types/tool';
import { isConverterTool } from './converterExport';

export type BatchItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface BatchOutputArtifact {
  blob: Blob;
  filename: string;
  summary: string;
  previewUrl?: string;
  textPreview?: string;
}

export interface BatchQueueItem {
  id: string;
  file: File;
  status: BatchItemStatus;
  durationMs?: number;
  error?: string;
  output?: BatchOutputArtifact;
}

const NON_FILE_INPUT_TOKENS = new Set(['input', 'text', 'form', 'preset', 'mic', 'canvas']);

const BATCH_EXCLUDED_ENGINES = new Set<ToolEngineId>([
  'pdf-merge',
  'zip-creator',
  'zip-extractor',
  'document-renamer',
  'dimension-checker',
  'calculator',
  'print-calculator',
  'qr-generator',
  'qr-scanner',
  'barcode-generator',
  'business-doc',
  'letter-generator',
  'document-checklist',
  'text-utility',
  'typing-tool',
  'speech-tool',
  'ai-assistant',
  'media-compressor',
]);

const EXTRA_BATCH_FILE_ENGINES = new Set<ToolEngineId>([
  'image-compress',
  'image-kb-compress',
  'image-resize',
  'image-crop',
  'image-bg-remove',
  'image-enhance',
  'image-dpi',
  'image-strip-exif',
  'document-scanner',
  'pdf-compress',
  'pdf-rotate',
  'pdf-watermark',
  'pdf-page-numbers',
  'pdf-ocr',
  'print-layout',
]);

/**
 * Determines whether a tool accepts file uploads and supports simultaneous
 * multi-file Batch Process mode.
 */
export function supportsBatchProcess(tool: ToolDefinition): boolean {
  if (BATCH_EXCLUDED_ENGINES.has(tool.engineId)) return false;
  if (tool.processingType === 'calculator' || tool.processingType === 'generator') return false;

  const acceptsFileExtension = tool.acceptedFormats.some(
    (fmt) => !NON_FILE_INPUT_TOKENS.has(fmt.toLowerCase())
  );
  if (!acceptsFileExtension) return false;

  if (isConverterTool(tool)) return true;
  if (EXTRA_BATCH_FILE_ENGINES.has(tool.engineId)) return true;
  return false;
}

export function buildFileFingerprint(file: Pick<File, 'name' | 'size' | 'lastModified'>): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function deduplicateBatchFiles(
  existing: File[],
  incoming: File[],
  maxFiles = 25
): File[] {
  const seen = new Set(existing.map((f) => buildFileFingerprint(f)));
  const merged = [...existing];
  for (const file of incoming) {
    if (merged.length >= maxFiles) break;
    const fp = buildFileFingerprint(file);
    if (!seen.has(fp)) {
      seen.add(fp);
      merged.push(file);
    }
  }
  return merged;
}

export function createBatchQueueItems(files: File[]): BatchQueueItem[] {
  return files.map((file, idx) => ({
    id: `${idx}-${buildFileFingerprint(file)}`,
    file,
    status: 'queued',
  }));
}

export function ensureUniqueArchiveFilename(filename: string, usedNames: Set<string>): string {
  const clean = filename.replace(/[/\\]/g, '_').trim() || 'output.bin';
  if (!usedNames.has(clean)) {
    usedNames.add(clean);
    return clean;
  }

  const dotIdx = clean.lastIndexOf('.');
  const stem = dotIdx > 0 ? clean.slice(0, dotIdx) : clean;
  const ext = dotIdx > 0 ? clean.slice(dotIdx) : '';

  let counter = 2;
  let candidate = `${stem} (${counter})${ext}`;
  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = `${stem} (${counter})${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
}

export async function buildBatchZipBundle(
  items: BatchQueueItem[],
  toolSlug: string
): Promise<{ blob: Blob; filename: string; count: number }> {
  const completed = items.filter((item) => item.status === 'done' && item.output);
  if (completed.length === 0) {
    throw new Error('No converted files ready to download yet.');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const item of completed) {
    const uniqueName = ensureUniqueArchiveFilename(item.output!.filename, usedNames);
    zip.file(uniqueName, item.output!.blob);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return {
    blob,
    filename: `${toolSlug}_batch_${completed.length}_files.zip`,
    count: completed.length,
  };
}

export interface SimultaneousBatchResult {
  index: number;
  output?: BatchOutputArtifact;
  error?: string;
  durationMs: number;
}

/**
 * Executes file conversions simultaneously using a bounded worker pool so
 * multiple files convert in parallel without exhausting browser memory.
 */
export async function runSimultaneousBatch<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<BatchOutputArtifact>,
  options: {
    concurrency?: number;
    onItemUpdate?: (index: number, patch: Partial<BatchQueueItem>) => void;
  } = {}
): Promise<SimultaneousBatchResult[]> {
  if (items.length === 0) return [];

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, items.length));
  const results: SimultaneousBatchResult[] = new Array(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) return;

      const t0 = performance.now();
      options.onItemUpdate?.(idx, { status: 'processing', error: undefined });

      try {
        const output = await worker(items[idx], idx);
        const durationMs = performance.now() - t0;
        results[idx] = { index: idx, output, durationMs };
        options.onItemUpdate?.(idx, { status: 'done', output, durationMs, error: undefined });
      } catch (err) {
        const durationMs = performance.now() - t0;
        const message = err instanceof Error ? err.message : 'Conversion failed.';
        results[idx] = { index: idx, error: message, durationMs };
        options.onItemUpdate?.(idx, { status: 'error', error: message, durationMs });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}
