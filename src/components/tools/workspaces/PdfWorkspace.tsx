import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RotateCcw, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import type { ToolExportShortcut } from '../../../lib/converterExport';
import { useToolTray as useAuth } from '../../../context/ToolTrayContext';
import {
  addPageNumbersToPdf,
  addWatermarkToPdf,
  compressPdf,
  createEncryptedPdfVault,
  createPaginatedTextPdf,
  editPdfPageOrder,
  excelToPdf,
  extractTextFromPdf,
  getPdfPageCount,
  mergePdfsAndImages,
  pdfToExcel,
  pdfToImages,
  pdfToWordDoc,
  printLayoutPdf,
  rotatePdf,
  splitPdf,
  textOrDocxToPdf,
  type ProcessedFileResult,
} from '../../../engines/pdfEngine';
import { runImageOcr } from '../../../engines/textOcrArchiveEngine';
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export const PdfWorkspace: React.FC<{
  tool: ToolDefinition;
  onRegisterExportShortcut?: (shortcut: ToolExportShortcut | null) => void;
}> = ({ tool, onRegisterExportShortcut }) => {
  const { recordToolUsage } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const latestExportRef = useRef<() => Promise<void> | void>(() => {});

  const [files, setFiles] = useState<File[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedFileResult | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Array<{ url: string; name: string; sizeKb: number }>>([]);
  const [ocrTextPreview, setOcrTextPreview] = useState<string>('');

  // Tool-specific controls
  const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [splitMode, setSplitMode] = useState<'all' | 'range'>('range');
  const [pageRange, setPageRange] = useState('1-2');
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [pageNumPos, setPageNumPos] = useState<'bottom-center' | 'bottom-right' | 'top-right'>('bottom-center');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);
  const [password, setPassword] = useState('');
  const [htmlInput, setHtmlInput] = useState('<h1>Application Summary</h1>\n<p>Prepared with Digital Tools Tray — Developed by BakeWeb (ibakeweb.in) &amp; Product of DIGITAL INDIA PROJECT (digitalindiaproject.com).</p>');
  const [nUpCount, setNUpCount] = useState<2 | 4>(2);
  const [batchMode, setBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [zipBusy, setZipBusy] = useState(false);

  const canBatch = supportsBatchProcess(tool);
  const allowMultiple =
    batchMode || tool.engineId === 'pdf-merge' || tool.engineId === 'image-to-pdf';

  useEffect(() => {
    setBatchMode(false);
    setBatchQueue([]);
    setFiles([]);
    setResult(null);
    setError(null);
    setImagePreviews([]);
    setOcrTextPreview('');
    setPageCount(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [tool.slug]);

  const handleFilesSelected = async (selected: FileList | null) => {
    if (!selected || !selected.length) return;
    const arr = Array.from(selected);
    const nextFiles = allowMultiple ? deduplicateBatchFiles(files, arr) : [arr[0]];
    setFiles(nextFiles);
    setResult(null);
    setError(null);
    setImagePreviews([]);
    setOcrTextPreview('');

    if (batchMode) {
      setBatchQueue(createBatchQueueItems(nextFiles));
    } else {
      setBatchQueue([]);
    }

    const first = nextFiles[0];
    if (first && first.name.toLowerCase().endsWith('.pdf')) {
      try {
        const count = await getPdfPageCount(first);
        setPageCount(count);
        if (count >= 1) setPageRange(`1-${Math.min(2, count)}`);
      } catch {
        setPageCount(null);
      }
    } else {
      setPageCount(null);
    }
  };

  const resetAll = () => {
    imagePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setFiles([]);
    setBatchQueue([]);
    setPageCount(null);
    setResult(null);
    setError(null);
    setImagePreviews([]);
    setOcrTextPreview('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleToggleBatch = (next: boolean) => {
    setBatchMode(next);
    setResult(null);
    setError(null);
    if (next) {
      setBatchQueue(createBatchQueueItems(files));
    } else {
      setBatchQueue([]);
      if (files.length > 1 && tool.engineId !== 'pdf-merge' && tool.engineId !== 'image-to-pdf') {
        setFiles([files[0]]);
      }
    }
  };

  const handleRemoveBatchItem = (id: string) => {
    const remaining = batchQueue.filter((item) => item.id !== id);
    setBatchQueue(remaining);
    setFiles(remaining.map((item) => item.file));
  };

  const processSinglePdfFile = async (
    primary: File,
    captureSinglePreviews = true
  ): Promise<ProcessedFileResult> => {
    switch (tool.engineId) {
      case 'image-to-pdf':
        return await mergePdfsAndImages([primary]);
      case 'pdf-split':
        return await splitPdf(primary, splitMode, pageRange);
      case 'pdf-compress':
        return await compressPdf(primary, compressionLevel);
      case 'pdf-rotate':
        return await rotatePdf(primary, rotateAngle);
      case 'pdf-delete-pages':
        return await editPdfPageOrder(primary, 'delete', pageRange);
      case 'pdf-extract-pages':
        return await editPdfPageOrder(primary, 'extract', pageRange);
      case 'pdf-reorder-pages':
        return await editPdfPageOrder(primary, 'reorder', pageRange);
      case 'pdf-page-numbers':
        return await addPageNumbersToPdf(primary, pageNumPos);
      case 'pdf-watermark':
        return await addWatermarkToPdf(primary, watermarkText, watermarkOpacity);
      case 'pdf-protect':
        return await createEncryptedPdfVault(primary, password);
      case 'pdf-unlock': {
        const textInfo = await extractTextFromPdf(primary).catch(() => null);
        if (primary.name.toLowerCase().endsWith('.html')) {
          throw new Error(
            'Open the protected HTML vault directly in your browser and enter your password to extract the PDF.'
          );
        }
        const unlocked = await compressPdf(primary, 'low');
        unlocked.summary = textInfo
          ? `Re-saved unlocked PDF (${textInfo.pageCount} pages).`
          : 'Re-saved PDF without restriction flags.';
        return unlocked;
      }
      case 'pdf-to-image': {
        const targetMime =
          tool.presetConfig?.format === 'image/png' ? 'image/png' : 'image/jpeg';
        const imgRes = await pdfToImages(primary, targetMime, 2);
        if (captureSinglePreviews) {
          setImagePreviews(imgRes.previews);
        } else {
          imgRes.previews.forEach((p) => URL.revokeObjectURL(p.url));
        }
        return {
          blob: imgRes.downloadBlob,
          filename: imgRes.downloadName,
          mimeType: imgRes.downloadBlob.type,
          pageCount: imgRes.previews.length,
          summary: `Rendered ${imgRes.previews.length} page(s) to ${targetMime === 'image/png' ? 'PNG' : 'JPG'}.`,
        };
      }
      case 'pdf-to-word':
        return await pdfToWordDoc(primary);
      case 'word-to-pdf':
        return await textOrDocxToPdf(primary);
      case 'pdf-to-excel':
        return await pdfToExcel(primary);
      case 'excel-to-pdf':
        return await excelToPdf(primary);
      case 'html-to-pdf':
        return await textOrDocxToPdf(primary);
      case 'pdf-ocr': {
        const rendered = await pdfToImages(primary, 'image/png', 1.8);
        const texts: string[] = [];
        for (let i = 0; i < rendered.previews.length; i++) {
          if (captureSinglePreviews) {
            setProgressText(`Running OCR on page ${i + 1} of ${rendered.previews.length}...`);
          }
          const res = await fetch(rendered.previews[i].url);
          const blob = await res.blob();
          const f = new File([blob], `page_${i + 1}.png`, { type: 'image/png' });
          const pageTxt = await runImageOcr(f, 'eng');
          texts.push(`--- Page ${i + 1} ---\n${pageTxt}`);
          URL.revokeObjectURL(rendered.previews[i].url);
        }
        const combined = texts.join('\n\n');
        if (captureSinglePreviews) setOcrTextPreview(combined);
        return await createPaginatedTextPdf(
          combined,
          `${primary.name.replace(/\.pdf$/i, '')}_ocr.pdf`,
          'OCR Extracted PDF Text'
        );
      }
      case 'print-layout': {
        const layout =
          (tool.presetConfig?.layout as 'a4-to-a3' | 'nup' | 'booklet' | 'optimize') || 'optimize';
        return await printLayoutPdf(primary, layout, nUpCount);
      }
      default:
        throw new Error('Unsupported PDF operation.');
    }
  };

  const handleDownloadBatchZip = async (queueSnapshot = batchQueue) => {
    setZipBusy(true);
    try {
      const zip = await buildBatchZipBundle(queueSnapshot, tool.slug);
      downloadBlob(zip.blob, zip.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ZIP bundle.');
    } finally {
      setZipBusy(false);
    }
  };

  const handleProcess = async (autoDownload = false) => {
    if (tool.engineId !== 'html-to-pdf' && files.length === 0) {
      setError('Please upload at least one file first.');
      return;
    }

    if (batchMode && files.length > 0) {
      setProcessing(true);
      setError(null);
      setResult(null);
      const initialQueue = createBatchQueueItems(files);
      setBatchQueue(initialQueue);
      setProgressText(`Processing ${files.length} files simultaneously...`);
      const t0 = performance.now();

      try {
        const updatedQueue = [...initialQueue];
        await runSimultaneousBatch(
          initialQueue,
          async (item) => {
            const converted = await processSinglePdfFile(item.file, false);
            return {
              blob: converted.blob,
              filename: converted.filename,
              summary: converted.summary,
            };
          },
          {
            concurrency: tool.engineId === 'pdf-ocr' ? 2 : 3,
            onItemUpdate: (idx, patch) => {
              updatedQueue[idx] = { ...updatedQueue[idx], ...patch };
              setBatchQueue([...updatedQueue]);
            },
          }
        );

        const doneCount = updatedQueue.filter((q) => q.status === 'done').length;
        if (doneCount === 0) {
          setError('All files in the batch failed to convert. Check file formats and retry.');
        } else if (autoDownload) {
          await handleDownloadBatchZip(updatedQueue);
        }

        const totalInBytes = files.reduce((acc, f) => acc + f.size, 0);
        await recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: doneCount > 0 ? 'completed' : 'failed',
          inputSummary: `Batch: ${files.length} file(s) (${(totalInBytes / 1024).toFixed(1)} KB)`,
          outputSummary: `${doneCount}/${files.length} converted simultaneously`,
          durationMs: performance.now() - t0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Batch processing failed.');
      } finally {
        setProcessing(false);
        setProgressText('');
      }
      return;
    }

    setProcessing(true);
    setError(null);
    setProgressText('Initializing browser engine...');
    const t0 = performance.now();

    try {
      let out: ProcessedFileResult | null = null;
      const primary = files[0];

      if (tool.engineId === 'pdf-merge' || (tool.engineId === 'image-to-pdf' && !batchMode)) {
        setProgressText('Combining documents & images into PDF...');
        out = await mergePdfsAndImages(files);
      } else if (tool.engineId === 'html-to-pdf' && !primary) {
        setProgressText('Rendering HTML content to PDF...');
        const doc = new DOMParser().parseFromString(htmlInput, 'text/html');
        const cleanText = doc.body?.innerText || doc.body?.textContent || htmlInput;
        out = await createPaginatedTextPdf(cleanText, 'html_export.pdf');
      } else {
        setProgressText(`Processing ${primary.name}...`);
        out = await processSinglePdfFile(primary, true);
      }

      if (out) {
        setResult(out);
        if (autoDownload) {
          downloadBlob(out.blob, out.filename);
        }
        const totalInBytes = files.reduce((acc, f) => acc + f.size, 0);
        await recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: 'completed',
          inputSummary: `${files.length} file(s) (${(totalInBytes / 1024).toFixed(1)} KB)`,
          outputSummary: out.summary,
          durationMs: performance.now() - t0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  latestExportRef.current = async () => {
    if (batchMode) {
      const hasDoneBatch = batchQueue.some((q) => q.status === 'done' && q.output);
      if (hasDoneBatch) {
        await handleDownloadBatchZip(batchQueue);
        return;
      }
      if (files.length > 0) {
        await handleProcess(true);
        return;
      }
      inputRef.current?.click();
      return;
    }
    if (result) {
      downloadBlob(result.blob, result.filename);
      return;
    }
    if (files.length > 0 || tool.engineId === 'html-to-pdf') {
      await handleProcess(true);
      return;
    }
    inputRef.current?.click();
  };

  const hasReadyExport = Boolean(
    result ||
      files.length > 0 ||
      tool.engineId === 'html-to-pdf' ||
      batchQueue.some((q) => q.status === 'done')
  );

  useEffect(() => {
    onRegisterExportShortcut?.({
      ready: hasReadyExport,
      onExport: () => latestExportRef.current(),
    });
    return () => {
      onRegisterExportShortcut?.(null);
    };
  }, [hasReadyExport, onRegisterExportShortcut, tool.slug]);

  const totalInputBytes = files.reduce((acc, f) => acc + f.size, 0);
  const savedPct =
    result && totalInputBytes > 0
      ? Math.round(((totalInputBytes - result.blob.size) / totalInputBytes) * 100)
      : null;

  return (
    <div className="space-y-6">
      {canBatch && (
        <BatchModeToggle
          enabled={batchMode}
          onToggle={handleToggleBatch}
          queuedCount={files.length}
          disabled={processing}
          note={
            tool.engineId === 'image-to-pdf'
              ? batchMode
                ? 'Batch ON: Each uploaded file converts simultaneously into its own separate PDF (ZIP).'
                : 'Default merges multiple images into 1 PDF. Enable Batch Process to convert each file into a separate PDF.'
              : undefined
          }
        />
      )}

      {tool.engineId === 'html-to-pdf' && !batchMode && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#252525] dark:text-[#F4F3EE]">
            Paste HTML Markup (or upload an .html file below)
          </label>
          <textarea
            rows={5}
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            className="w-full rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] p-3 font-mono text-xs text-[#252525] dark:text-[#F4F3EE]"
          />
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFilesSelected(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] rounded-xl p-8 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210] transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          multiple={allowMultiple}
          accept={tool.acceptedFormats.join(',')}
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />
        <Upload className="w-8 h-8 mx-auto text-[#707070] mb-3" />
        <p className="font-medium text-sm text-[#252525] dark:text-[#F4F3EE]">
          {batchMode && files.length > 0
            ? `Click or drop to add more files (${files.length} queued)`
            : `Click to upload or drag and drop ${allowMultiple ? 'multiple files' : 'a file'}`}
        </p>
        <p className="text-xs text-[#707070] dark:text-[#A6A49C] mt-1">
          Supported: {tool.acceptedFormats.join(', ')} · Max {tool.maxFileSizeMb} MB
          {batchMode ? ' · Up to 25 files per batch' : ''}
        </p>
      </div>

      {/* Batch Queue or Single/Merge File List */}
      {batchMode ? (
        <BatchResultsPanel
          items={batchQueue}
          processing={processing}
          zipBusy={zipBusy}
          onRemoveItem={handleRemoveBatchItem}
          onDownloadItem={(item) => {
            if (item.output) downloadBlob(item.output.blob, item.output.filename);
          }}
          onDownloadAllZip={() => void handleDownloadBatchZip(batchQueue)}
        />
      ) : (
        files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, idx) => (
              <div
                key={`${f.name}-${idx}`}
                className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-[#F06455] shrink-0" />
                  <span className="truncate font-medium text-[#252525] dark:text-[#F4F3EE]">
                    {f.name}
                  </span>
                </div>
                <span className="text-xs text-[#707070] tabular-nums shrink-0 ml-3">
                  {(f.size / 1024).toFixed(1)} KB
                  {idx === 0 && pageCount ? ` · ${pageCount} pages` : ''}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Tool-specific options */}
      {tool.engineId === 'pdf-compress' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              { id: 'low', label: 'Light (Stream Optimize)', desc: 'Lossless text & vector optimization' },
              { id: 'medium', label: 'Balanced (Recommended)', desc: 'Sharp 135 DPI for portals' },
              { id: 'high', label: 'Strong (Smallest Size)', desc: 'Maximum reduction for 1–2 MB caps' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setCompressionLevel(opt.id)}
              className={`text-left p-3.5 rounded-lg border cursor-pointer transition-colors ${
                compressionLevel === opt.id
                  ? 'border-[#F5C542] bg-[#F5C542]/10'
                  : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              <div className="text-sm font-semibold text-[#252525] dark:text-[#F4F3EE]">
                {opt.label}
              </div>
              <div className="text-xs text-[#707070] dark:text-[#A6A49C] mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      )}

      {(tool.engineId === 'pdf-split' ||
        tool.engineId === 'pdf-delete-pages' ||
        tool.engineId === 'pdf-extract-pages' ||
        tool.engineId === 'pdf-reorder-pages') && (
        <div className="space-y-3">
          {tool.engineId === 'pdf-split' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSplitMode('range')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  splitMode === 'range'
                    ? 'border-[#F5C542] bg-[#F5C542]/15'
                    : 'border-[#EAEAEA] dark:border-[#2C2C27]'
                }`}
              >
                Extract Custom Range
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  splitMode === 'all'
                    ? 'border-[#F5C542] bg-[#F5C542]/15'
                    : 'border-[#EAEAEA] dark:border-[#2C2C27]'
                }`}
              >
                Split Every Page (ZIP)
              </button>
            </div>
          )}
          {(tool.engineId !== 'pdf-split' || splitMode === 'range') && (
            <div>
              <label className="block text-xs font-medium text-[#707070] mb-1">
                {tool.engineId === 'pdf-delete-pages'
                  ? 'Pages to Delete (e.g., 2, 4-5)'
                  : tool.engineId === 'pdf-reorder-pages'
                  ? 'New Page Order (e.g., 3, 1, 2)'
                  : 'Page Numbers / Range (e.g., 1-3, 5)'}
              </label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm"
              />
            </div>
          )}
        </div>
      )}

      {tool.engineId === 'pdf-rotate' && (
        <div className="flex flex-wrap gap-2">
          {([90, 180, 270] as const).map((deg) => (
            <button
              key={deg}
              type="button"
              onClick={() => setRotateAngle(deg)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
                rotateAngle === deg
                  ? 'border-[#F5C542] bg-[#F5C542]/15'
                  : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              Rotate {deg}°
            </button>
          ))}
        </div>
      )}

      {tool.engineId === 'pdf-page-numbers' && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'bottom-center', label: 'Bottom Center' },
              { id: 'bottom-right', label: 'Bottom Right' },
              { id: 'top-right', label: 'Top Right' },
            ] as const
          ).map((pos) => (
            <button
              key={pos.id}
              type="button"
              onClick={() => setPageNumPos(pos.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer ${
                pageNumPos === pos.id
                  ? 'border-[#F5C542] bg-[#F5C542]/15'
                  : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      )}

      {tool.engineId === 'pdf-watermark' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">Watermark Text</label>
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">
              Opacity ({Math.round(watermarkOpacity * 100)}%)
            </label>
            <input
              type="range"
              min={0.08}
              max={0.6}
              step={0.02}
              value={watermarkOpacity}
              onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
              className="w-full mt-2 accent-[#F5C542]"
            />
          </div>
        </div>
      )}

      {tool.engineId === 'pdf-protect' && (
        <div>
          <label className="block text-xs font-medium text-[#707070] mb-1">
            Encryption Password (min 4 characters)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter vault password"
            className="w-full sm:w-80 px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm"
          />
        </div>
      )}

      {tool.engineId === 'print-layout' && tool.presetConfig?.layout === 'nup' && (
        <div className="flex gap-2">
          {([2, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNUpCount(n)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
                nUpCount === n
                  ? 'border-[#F5C542] bg-[#F5C542]/15'
                  : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              {n} Pages Per Sheet
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleProcess(false)}
          disabled={processing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm transition-colors cursor-pointer disabled:opacity-60"
        >
          {processing && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {processing
              ? progressText || 'Processing...'
              : batchMode
              ? `Batch Convert ${files.length || ''} ${files.length === 1 ? 'File' : 'Files'}`.trim()
              : `Run ${tool.name}`}
          </span>
        </button>

        {(files.length > 0 || result || batchQueue.length > 0) && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-sm font-medium hover:bg-[#FAFAF7] dark:hover:bg-[#252522] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Process Another</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-lg border border-[#F06455]/40 bg-[#F06455]/10 text-sm text-[#B91C1C] dark:text-[#FCA5A5]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ready for Download</span>
              </div>
              <p className="text-sm text-[#252525] dark:text-[#F4F3EE]">{result.summary}</p>
              <div className="flex flex-wrap gap-4 text-xs text-[#707070] tabular-nums">
                {totalInputBytes > 0 && (
                  <span>Original: {(totalInputBytes / 1024).toFixed(1)} KB</span>
                )}
                <span>Output: {(result.blob.size / 1024).toFixed(1)} KB</span>
                {savedPct !== null && savedPct > 0 && (
                  <span className="font-semibold text-[#16A34A]">Saved {savedPct}%</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => downloadBlob(result.blob, result.filename)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#252525] dark:bg-[#F5C542] text-white dark:text-[#252525] font-semibold text-sm hover:opacity-90 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download {result.filename.split('.').pop()?.toUpperCase()}</span>
            </button>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {imagePreviews.slice(0, 8).map((img) => (
                <a
                  key={img.name}
                  href={img.url}
                  download={img.name}
                  className="block rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] overflow-hidden bg-white p-1.5"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-32 object-contain"
                  />
                  <div className="text-[11px] text-[#707070] mt-1 truncate text-center tabular-nums">
                    {img.name} · {img.sizeKb} KB
                  </div>
                </a>
              ))}
            </div>
          )}

          {ocrTextPreview && (
            <textarea
              readOnly
              rows={7}
              value={ocrTextPreview}
              className="w-full rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] p-3 text-xs font-mono"
            />
          )}
        </div>
      )}
    </div>
  );
};
