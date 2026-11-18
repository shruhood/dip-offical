import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Copy, Check, Loader2, Mic, Volume2 } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import type { ToolExportShortcut } from '../../../lib/converterExport';
import { useToolTray } from '../../../context/ToolTrayContext';
import { extractTextFromPdf, createPaginatedTextPdf } from '../../../engines/pdfEngine';
import {
  cleanAndTransformText,
  compressBrowserMedia,
  convertTabularData,
  createZipArchive,
  extractZipArchive,
  runImageOcr,
} from '../../../engines/textOcrArchiveEngine';
import {
  buildBatchZipBundle,
  createBatchQueueItems,
  deduplicateBatchFiles,
  runSimultaneousBatch,
  supportsBatchProcess,
  type BatchQueueItem,
} from '../../../lib/batchProcessor';
import { BatchModeToggle } from '../BatchModeToggle';
import { BatchResultsPanel } from '../BatchResultsPanel';

function saveBlob(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2500);
}

const HINDI_KEYS = ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ', 'क', 'ख', 'ग', 'घ', 'च', 'छ', 'ज', 'झ', 'ट', 'ठ', 'ड', 'ढ', 'ण', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब', 'भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'ष', 'स', 'ह', 'ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं', '्', '।'];
const GUJARATI_KEYS = ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'એ', 'ઐ', 'ઓ', 'ઔ', 'ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ', 'ટ', 'ઠ', 'ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ', 'બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ', 'હ', 'ા', 'િ', 'ી', 'ુ', 'ૂ', 'ે', 'ૈ', 'ો', 'ૌ', 'ં', '્'];

export const TextOcrArchiveWorkspace: React.FC<{
  tool: ToolDefinition;
  onRegisterExportShortcut?: (shortcut: ToolExportShortcut | null) => void;
}> = ({ tool, onRegisterExportShortcut }) => {
  const { recordToolUsage } = useToolTray();
  const fileRef = useRef<HTMLInputElement>(null);
  const latestExportRef = useRef<() => Promise<void> | void>(() => {});
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [renamePattern, setRenamePattern] = useState('CUSTOMER_DOC');
  const [zipEntries, setZipEntries] = useState<Array<{ name: string; size: number; blob: Blob }>>([]);
  const [listening, setListening] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [zipBusy, setZipBusy] = useState(false);

  const canBatch = supportsBatchProcess(tool);

  useEffect(() => {
    setBatchMode(false);
    setBatchQueue([]);
    setFiles([]);
    setText('');
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [tool.slug]);

  const handleBatchToggle = (next: boolean) => {
    setBatchMode(next);
    setError(null);
    if (next) {
      setBatchQueue(createBatchQueueItems(files));
    } else {
      setBatchQueue([]);
      if (files.length > 1) setFiles([files[0]]);
    }
  };

  const handleBatchFileInput = (selected: FileList | null) => {
    if (!selected || !selected.length) return;
    const arr = Array.from(selected);
    if (batchMode) {
      const nextFiles = deduplicateBatchFiles(files, arr);
      setFiles(nextFiles);
      setBatchQueue(createBatchQueueItems(nextFiles));
    } else {
      setFiles([arr[0]]);
      setBatchQueue([]);
    }
    setError(null);
  };

  const handleRemoveBatchItem = (id: string) => {
    const remaining = batchQueue.filter((item) => item.id !== id);
    setBatchQueue(remaining);
    setFiles(remaining.map((item) => item.file));
  };

  const handleDownloadBatchZip = async (queueSnapshot = batchQueue) => {
    setZipBusy(true);
    try {
      const zip = await buildBatchZipBundle(queueSnapshot, tool.slug);
      saveBlob(zip.blob, zip.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create batch ZIP.');
    } finally {
      setZipBusy(false);
    }
  };

  const extractOcrForFile = async (file: File, onProgress?: (pct: number) => void): Promise<string> => {
    if (tool.presetConfig?.mode === 'pdf-text' || file.name.toLowerCase().endsWith('.pdf')) {
      const res = await extractTextFromPdf(file);
      return res.text;
    }
    const lang = (tool.presetConfig?.lang as 'eng' | 'hin' | 'guj') || 'eng';
    return await runImageOcr(file, lang, onProgress);
  };

  const handleOcr = async (autoDownloadPdf = false) => {
    if (batchMode) {
      if (files.length === 0) {
        setError('Please upload at least one PDF or image first.');
        return;
      }
      setBusy(true);
      setError(null);
      const initialQueue = createBatchQueueItems(files);
      setBatchQueue(initialQueue);
      const updatedQueue = [...initialQueue];

      try {
        await runSimultaneousBatch(
          initialQueue,
          async (item) => {
            const extracted = await extractOcrForFile(item.file);
            const stem = item.file.name.replace(/\.[^.]+$/, '');
            if (autoDownloadPdf) {
              const pdf = await createPaginatedTextPdf(extracted || ' ', `${stem}.pdf`, tool.name);
              return {
                blob: pdf.blob,
                filename: pdf.filename,
                summary: `${extracted.length} chars`,
                textPreview: extracted,
              };
            }
            const txtBlob = new Blob([extracted], { type: 'text/plain;charset=utf-8' });
            return {
              blob: txtBlob,
              filename: `${stem}.txt`,
              summary: `${extracted.length} chars`,
              textPreview: extracted,
            };
          },
          {
            concurrency: 2,
            onItemUpdate: (idx, patch) => {
              updatedQueue[idx] = { ...updatedQueue[idx], ...patch };
              setBatchQueue([...updatedQueue]);
            },
          }
        );

        const combined = updatedQueue
          .filter((q) => q.status === 'done' && q.output?.textPreview)
          .map((q) => `=== ${q.file.name} ===\n${q.output?.textPreview || ''}`)
          .join('\n\n');
        if (combined) setText(combined);

        if (autoDownloadPdf) {
          await handleDownloadBatchZip(updatedQueue);
        }
        await recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: 'completed',
          inputSummary: `Batch OCR (${files.length} files)`,
          outputSummary: `${combined.length} chars extracted`,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Batch OCR failed.');
      } finally {
        setBusy(false);
        setOcrProgress(null);
      }
      return;
    }

    if (!files[0]) {
      setError('Please upload a PDF or image first.');
      return;
    }
    setBusy(true);
    setError(null);
    setOcrProgress(0);
    try {
      const extracted = await extractOcrForFile(files[0], (pct) => setOcrProgress(pct));
      setText(extracted);
      if (autoDownloadPdf) {
        const pdf = await createPaginatedTextPdf(extracted || ' ', `${tool.slug}.pdf`, tool.name);
        saveBlob(pdf.blob, pdf.filename);
      }
      await recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: files[0].name,
        outputSummary: `${extracted.length} chars extracted`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR processing failed.');
    } finally {
      setBusy(false);
      setOcrProgress(null);
    }
  };

  const handleBatchDataConvert = async (autoDownloadZip = false) => {
    const mode = (tool.presetConfig?.mode as string) || 'csv-to-xlsx';
    const target = mode === 'csv-to-xlsx' ? 'xlsx' : 'csv';
    if (files.length === 0) {
      setError('Upload one or more CSV, Excel, or JSON files for batch conversion.');
      return;
    }
    setBusy(true);
    setError(null);
    const initialQueue = createBatchQueueItems(files);
    setBatchQueue(initialQueue);
    const updatedQueue = [...initialQueue];

    try {
      await runSimultaneousBatch(
        initialQueue,
        async (item) => {
          const out = await convertTabularData(item.file, target);
          return {
            blob: out.blob,
            filename: out.filename,
            summary: `Converted to ${target.toUpperCase()}`,
            textPreview: out.previewText,
          };
        },
        {
          concurrency: 3,
          onItemUpdate: (idx, patch) => {
            updatedQueue[idx] = { ...updatedQueue[idx], ...patch };
            setBatchQueue([...updatedQueue]);
          },
        }
      );

      const firstDone = updatedQueue.find((q) => q.status === 'done' && q.output?.textPreview);
      if (firstDone?.output?.textPreview) {
        setText(firstDone.output.textPreview);
      }
      if (autoDownloadZip) {
        await handleDownloadBatchZip(updatedQueue);
      }
      await recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: `Batch convert (${files.length} files)`,
        outputSummary: `Converted to ${target.toUpperCase()}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch data conversion failed.');
    } finally {
      setBusy(false);
    }
  };

  latestExportRef.current = async () => {
    if (tool.engineId === 'ocr-text') {
      if (batchMode) {
        const hasDone = batchQueue.some((q) => q.status === 'done' && q.output);
        if (hasDone) {
          await handleDownloadBatchZip(batchQueue);
          return;
        }
        if (files.length > 0) {
          await handleOcr(true);
          return;
        }
        fileRef.current?.click();
        return;
      }
      if (text.trim()) {
        const pdf = await createPaginatedTextPdf(text, `${tool.slug}.pdf`, tool.name);
        saveBlob(pdf.blob, pdf.filename);
        return;
      }
      if (files[0]) {
        await handleOcr(true);
        return;
      }
      fileRef.current?.click();
      return;
    }

    if (tool.engineId === 'data-converter') {
      if (batchMode) {
        const hasDone = batchQueue.some((q) => q.status === 'done' && q.output);
        if (hasDone) {
          await handleDownloadBatchZip(batchQueue);
          return;
        }
        if (files.length > 0) {
          await handleBatchDataConvert(true);
          return;
        }
        fileRef.current?.click();
        return;
      }
      const mode = (tool.presetConfig?.mode as string) || 'csv-to-xlsx';
      const target = mode === 'csv-to-xlsx' ? 'xlsx' : 'csv';
      const input = files[0] || text;
      if (!input) {
        fileRef.current?.click();
        return;
      }
      setError(null);
      try {
        const out = await convertTabularData(input, target);
        saveBlob(out.blob, out.filename);
        setText(out.previewText);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conversion failed.');
      }
      return;
    }

    if (tool.engineId === 'zip-creator' || tool.engineId === 'document-renamer') {
      if (!files.length) {
        fileRef.current?.click();
        return;
      }
      const out = await createZipArchive(
        files,
        tool.engineId === 'document-renamer' ? renamePattern : undefined
      );
      saveBlob(out.blob, out.filename);
      return;
    }

    const pdf = await createPaginatedTextPdf(text || ' ', `${tool.slug}.pdf`, tool.name);
    saveBlob(pdf.blob, pdf.filename);
  };

  const hasReadyExport =
    tool.engineId === 'text-utility' ||
    tool.engineId === 'speech-tool' ||
    Boolean(text.trim() || files.length > 0 || batchQueue.length > 0);

  useEffect(() => {
    onRegisterExportShortcut?.({
      ready: hasReadyExport,
      onExport: () => latestExportRef.current(),
    });
    return () => {
      onRegisterExportShortcut?.(null);
    };
  }, [hasReadyExport, onRegisterExportShortcut, tool.slug]);

  if (tool.engineId === 'ocr-text') {
    return (
      <div className="space-y-5">
        {canBatch && (
          <BatchModeToggle
            enabled={batchMode}
            onToggle={handleBatchToggle}
            queuedCount={files.length}
            disabled={busy}
          />
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleBatchFileInput(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] rounded-xl p-7 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]"
        >
          <input
            ref={fileRef}
            type="file"
            multiple={batchMode}
            accept={tool.acceptedFormats.join(',')}
            onChange={(e) => handleBatchFileInput(e.target.files)}
            className="hidden"
          />
          <Upload className="w-7 h-7 mx-auto text-[#707070] mb-2" />
          <p className="text-sm font-medium">
            {batchMode
              ? files.length > 0
                ? `${files.length} file(s) queued — click or drop to add more`
                : 'Upload multiple images or PDFs for simultaneous OCR'
              : files[0]
              ? files[0].name
              : 'Upload image or PDF for text extraction'}
          </p>
        </div>

        {batchMode && (
          <BatchResultsPanel
            items={batchQueue}
            processing={busy}
            zipBusy={zipBusy}
            onRemoveItem={handleRemoveBatchItem}
            onDownloadItem={(item) => {
              if (item.output) saveBlob(item.output.blob, item.output.filename);
            }}
            onDownloadAllZip={() => void handleDownloadBatchZip(batchQueue)}
          />
        )}

        <button
          type="button"
          onClick={() => void handleOcr(false)}
          disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] text-[#252525] font-semibold text-sm cursor-pointer disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {busy
              ? batchMode
                ? 'Running Simultaneous OCR...'
                : `Recognizing (${ocrProgress ?? 0}%)...`
              : batchMode
              ? `Batch Extract Text (${files.length || 0} Files)`
              : 'Extract Text'}
          </span>
        </button>

        {error && <p className="text-sm text-[#F06455]">{error}</p>}

        {text && (
          <div className="space-y-2">
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] p-4 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-semibold cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Text</span>
              </button>
              <button
                type="button"
                onClick={() => saveBlob(new Blob([text], { type: 'text/plain' }), `${tool.slug}.txt`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#252525] text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .TXT</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tool.engineId === 'zip-creator' || tool.engineId === 'document-renamer') {
    const runZip = async () => {
      if (!files.length) return;
      const out = await createZipArchive(
        files,
        tool.engineId === 'document-renamer' ? renamePattern : undefined
      );
      saveBlob(out.blob, out.filename);
      void recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: `${files.length} file(s)`,
        outputSummary: out.filename,
      });
    };
    return (
      <div className="space-y-5">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] rounded-xl p-7 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]"
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            className="hidden"
          />
          <Upload className="w-7 h-7 mx-auto text-[#707070] mb-2" />
          <p className="text-sm font-medium">{files.length ? `${files.length} file(s) selected` : 'Select multiple files to bundle'}</p>
        </div>
        {tool.engineId === 'document-renamer' && (
          <div>
            <label className="block text-xs text-[#707070] mb-1">Filename Prefix (e.g., PATEL_RAMESH_KYC)</label>
            <input
              type="text"
              value={renamePattern}
              onChange={(e) => setRenamePattern(e.target.value)}
              className="w-full max-w-sm px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm"
            />
          </div>
        )}
        <button
          type="button"
          onClick={runZip}
          disabled={!files.length}
          className="px-5 py-2.5 rounded-lg bg-[#F5C542] text-[#252525] font-semibold text-sm cursor-pointer disabled:opacity-50"
        >
          Create & Download ZIP
        </button>
      </div>
    );
  }

  if (tool.engineId === 'zip-extractor') {
    const runExtract = async (selected: FileList | null) => {
      if (!selected?.[0]) return;
      const list = await extractZipArchive(selected[0]);
      setZipEntries(list);
      void recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: selected[0].name,
        outputSummary: `${list.length} archive entries`,
      });
    };
    return (
      <div className="space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] rounded-xl p-7 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]"
        >
          <input ref={fileRef} type="file" accept=".zip" onChange={(e) => runExtract(e.target.files)} className="hidden" />
          <Upload className="w-7 h-7 mx-auto text-[#707070] mb-2" />
          <p className="text-sm font-medium">Upload .zip archive to inspect and extract files</p>
        </div>
        {zipEntries.length > 0 && (
          <div className="divide-y divide-[#EAEAEA] dark:divide-[#2C2C27] border border-[#EAEAEA] dark:border-[#2C2C27] rounded-xl">
            {zipEntries.map((item) => (
              <div key={item.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate">{item.name}</span>
                <button
                  type="button"
                  onClick={() => saveBlob(item.blob, item.name.split('/').pop() || 'file')}
                  className="text-xs font-semibold text-[#D97706] hover:underline cursor-pointer shrink-0 ml-3"
                >
                  Extract ({(item.size / 1024).toFixed(1)} KB)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tool.engineId === 'data-converter') {
    const mode = (tool.presetConfig?.mode as string) || 'csv-to-xlsx';
    const target = mode === 'csv-to-xlsx' ? 'xlsx' : mode === 'json-to-csv' ? 'csv' : 'csv';
    const handleConvert = async () => {
      if (batchMode) {
        await handleBatchDataConvert(false);
        return;
      }
      setError(null);
      try {
        const input = files[0] || text;
        if (!input) throw new Error('Upload a file or paste JSON/CSV data.');
        const out = await convertTabularData(input, target);
        saveBlob(out.blob, out.filename);
        setText(out.previewText);
        void recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: 'completed',
          inputSummary: files[0]?.name || 'Pasted text',
          outputSummary: out.filename,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conversion failed.');
      }
    };
    return (
      <div className="space-y-4">
        {canBatch && (
          <BatchModeToggle
            enabled={batchMode}
            onToggle={handleBatchToggle}
            queuedCount={files.length}
            disabled={busy}
          />
        )}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleBatchFileInput(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] rounded-xl p-6 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]"
        >
          <input
            ref={fileRef}
            type="file"
            multiple={batchMode}
            accept=".csv,.xlsx,.xls,.json"
            onChange={(e) => handleBatchFileInput(e.target.files)}
            className="hidden"
          />
          <p className="text-sm font-medium">
            {batchMode
              ? files.length > 0
                ? `${files.length} file(s) queued — click or drop to add more`
                : 'Upload multiple CSV, Excel, or JSON files for simultaneous conversion'
              : files[0]
              ? files[0].name
              : 'Upload CSV, Excel, or JSON file'}
          </p>
        </div>
        {batchMode && (
          <BatchResultsPanel
            items={batchQueue}
            processing={busy}
            zipBusy={zipBusy}
            onRemoveItem={handleRemoveBatchItem}
            onDownloadItem={(item) => {
              if (item.output) saveBlob(item.output.blob, item.output.filename);
            }}
            onDownloadAllZip={() => void handleDownloadBatchZip(batchQueue)}
          />
        )}
        {!batchMode && (
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Or paste JSON array / inspect preview..."
            className="w-full rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent p-3 font-mono text-xs"
          />
        )}
        {error && <p className="text-sm text-[#F06455]">{error}</p>}
        <button
          type="button"
          onClick={() => void handleConvert()}
          disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] text-[#252525] font-semibold text-sm cursor-pointer disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {busy
              ? 'Converting Batch...'
              : batchMode
              ? `Batch Convert ${files.length || 0} Files to ${target.toUpperCase()}`
              : `Convert & Download ${target.toUpperCase()}`}
          </span>
        </button>
      </div>
    );
  }

  if (tool.engineId === 'media-compressor') {
    const kind = (tool.presetConfig?.media as 'audio' | 'video') || 'audio';
    const runMedia = async () => {
      if (!files[0]) return;
      setBusy(true);
      setError(null);
      try {
        const out = await compressBrowserMedia(files[0], kind);
        saveBlob(out.blob, out.filename);
        setText(out.summary);
        void recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: 'completed',
          inputSummary: files[0].name,
          outputSummary: out.filename,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Browser media codec not supported for this file.');
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="space-y-4">
        <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] rounded-xl p-7 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]">
          <input ref={fileRef} type="file" accept={kind === 'audio' ? 'audio/*' : 'video/*'} onChange={(e) => setFiles(e.target.files ? [e.target.files[0]] : [])} className="hidden" />
          <p className="text-sm font-medium">{files[0] ? files[0].name : `Upload ${kind} file`}</p>
        </div>
        <button type="button" onClick={runMedia} disabled={busy || !files[0]} className="px-5 py-2.5 rounded-lg bg-[#F5C542] text-[#252525] font-semibold text-sm cursor-pointer disabled:opacity-50">
          {busy ? 'Compressing in Browser...' : `Compress ${kind.toUpperCase()}`}
        </button>
        {text && <p className="text-sm text-[#16A34A]">{text}</p>}
        {error && <p className="text-sm text-[#F06455]">{error}</p>}
      </div>
    );
  }

  if (tool.engineId === 'speech-tool') {
    const speak = () => {
      if (!('speechSynthesis' in window) || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utter);
    };
    const toggleDictation = () => {
      const SR = (window as unknown as { SpeechRecognition?: new () => { lang: string; continuous: boolean; onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; start: () => void; stop: () => void }; webkitSpeechRecognition?: new () => { lang: string; continuous: boolean; onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; start: () => void; stop: () => void } }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; continuous: boolean; onresult: (e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; start: () => void; stop: () => void } }).webkitSpeechRecognition;
      if (!SR) {
        setError('Voice recognition requires Chrome or Edge.');
        return;
      }
      const rec = new SR();
      rec.lang = 'en-IN';
      rec.continuous = false;
      rec.onresult = (e) => {
        const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ');
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      rec.onend = () => setListening(false);
      setListening(true);
      rec.start();
    };
    return (
      <div className="space-y-4">
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type text to listen aloud, or click Voice Dictate..." className="w-full rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent p-3 text-sm" />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={speak} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F5C542] text-[#252525] text-sm font-semibold cursor-pointer">
            <Volume2 className="w-4 h-4" /> Read Aloud
          </button>
          <button type="button" onClick={toggleDictation} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-sm font-semibold cursor-pointer">
            <Mic className="w-4 h-4" /> {listening ? 'Listening...' : 'Voice Dictate'}
          </button>
        </div>
        {error && <p className="text-sm text-[#F06455]">{error}</p>}
      </div>
    );
  }

  // Typing Tool + Text Utilities (Word Count, Char Count, Case Converter, Text Cleaner)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const lines = text ? text.split(/\r?\n/).length : 0;
  const scriptKeys =
    tool.presetConfig?.lang === 'hi'
      ? HINDI_KEYS
      : tool.presetConfig?.lang === 'gu'
      ? GUJARATI_KEYS
      : null;

  return (
    <div className="space-y-4">
      {scriptKeys && (
        <div className="p-3 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] flex flex-wrap gap-1.5">
          {scriptKeys.map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setText((prev) => prev + ch)}
              className="w-8 h-8 rounded bg-white dark:bg-[#1B1B18] border border-[#EAEAEA] dark:border-[#2C2C27] text-sm font-medium hover:border-[#F5C542] cursor-pointer"
            >
              {ch}
            </button>
          ))}
        </div>
      )}

      <textarea
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste text here..."
        className="w-full rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent p-4 text-sm"
      />

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#707070] tabular-nums">
        <span>
          {words} words · {chars} characters · {lines} lines · ~{Math.max(1, Math.ceil(words / 200))} min read
        </span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'upper', label: 'UPPER' },
              { id: 'lower', label: 'lower' },
              { id: 'title', label: 'Title Case' },
              { id: 'trim-spaces', label: 'Clean Spaces' },
              { id: 'dedupe', label: 'Dedupe Lines' },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setText(cleanAndTransformText(text, btn.id))}
              className="px-2.5 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] font-medium cursor-pointer"
            >
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              const pdf = await createPaginatedTextPdf(text || ' ', `${tool.slug}.pdf`);
              saveBlob(pdf.blob, pdf.filename);
              void recordToolUsage({
                toolSlug: tool.slug,
                toolName: tool.name,
                status: 'completed',
                outputSummary: pdf.filename,
              });
            }}
            className="px-3 py-1.5 rounded-lg bg-[#F5C542] text-[#252525] font-semibold cursor-pointer"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
};
