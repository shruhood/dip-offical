import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RotateCcw, CheckCircle2, AlertCircle, Loader2, PenLine } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import type { ToolExportShortcut } from '../../../lib/converterExport';
import { useToolTray as useAuth } from '../../../context/ToolTrayContext';
import {
  compressImage,
  compressToExactKb,
  cropImageAspect,
  enhanceOrScanImage,
  generatePassportPhotoAndSheet,
  inspectImageForPortals,
  removePhotoBackground,
  resizeImageExact,
  setJpegDpi,
  whitenSignatureImage,
  type ImageProcessResult,
} from '../../../engines/imageEngine';
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export const ImageWorkspace: React.FC<{
  tool: ToolDefinition;
  onRegisterExportShortcut?: (shortcut: ToolExportShortcut | null) => void;
}> = ({ tool, onRegisterExportShortcut }) => {
  const { recordToolUsage } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const latestExportRef = useRef<() => Promise<void> | void>(() => {});

  const [file, setFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageProcessResult | null>(null);
  const [passportResult, setPassportResult] = useState<{
    single: ImageProcessResult;
    sheet: ImageProcessResult;
    pdfBlob: Blob;
  } | null>(null);
  const [portalChecks, setPortalChecks] = useState<{
    width: number;
    height: number;
    sizeKb: number;
    checks: Array<{ portal: string; pass: boolean; detail: string }>;
  } | null>(null);

  // Controls
  const [qualityPct, setQualityPct] = useState(78);
  const [maxWidthPx, setMaxWidthPx] = useState(1600);
  const [targetKb, setTargetKb] = useState<number>(
    Number(tool.presetConfig?.targetKb) || 45
  );
  const [resizeW, setResizeW] = useState(213);
  const [resizeH, setResizeH] = useState(213);
  const [cropAspect, setCropAspect] = useState<'1:1' | '35:45' | '4:3' | '3:1'>('35:45');
  const [bgTol, setBgTol] = useState(40);
  const [bgColor, setBgColor] = useState<'#FFFFFF' | '#DCEBFF' | 'transparent'>('#FFFFFF');
  const [brightness, setBrightness] = useState(8);
  const [contrast, setContrast] = useState(14);
  const [bwThreshold, setBwThreshold] = useState(tool.engineId === 'document-scanner' ? 165 : 0);
  const [dpiValue, setDpiValue] = useState(300);
  const [passportPreset, setPassportPreset] = useState<'in-passport' | 'pan-card' | 'us-visa' | 'stamp'>('in-passport');
  const [sheetType, setSheetType] = useState<'4x6' | 'a4'>('4x6');
  const [sigThreshold, setSigThreshold] = useState(175);
  const [drawingMode, setDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [batchMode, setBatchMode] = useState(tool.slug === 'bulk-image-compressor');
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [zipBusy, setZipBusy] = useState(false);

  const canBatch = supportsBatchProcess(tool);

  const revokeBatchPreviews = (items: BatchQueueItem[]) => {
    for (const item of items) {
      if (item.output?.previewUrl) URL.revokeObjectURL(item.output.previewUrl);
    }
  };

  useEffect(() => {
    setBatchMode(tool.slug === 'bulk-image-compressor');
    setBatchQueue((prev) => {
      revokeBatchPreviews(prev);
      return [];
    });
    setFile(null);
    setOriginalPreview(null);
    setResult(null);
    setPassportResult(null);
    setPortalChecks(null);
    setError(null);
    setDrawingMode(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [tool.slug]);

  const handleFile = async (selected: FileList | null) => {
    if (!selected || !selected.length) return;
    const arr = Array.from(selected);

    if (batchMode) {
      const existing = batchQueue.map((item) => item.file);
      const nextFiles = deduplicateBatchFiles(existing, arr);
      revokeBatchPreviews(batchQueue);
      setBatchQueue(createBatchQueueItems(nextFiles));
      setFile(nextFiles[0] || null);
      setResult(null);
      setPassportResult(null);
      setError(null);
      setDrawingMode(false);
      return;
    }

    const f = arr[0];
    if (originalPreview) URL.revokeObjectURL(originalPreview);
    setFile(f);
    setOriginalPreview(URL.createObjectURL(f));
    setResult(null);
    setPassportResult(null);
    setError(null);
    setDrawingMode(false);

    if (tool.engineId === 'dimension-checker') {
      try {
        const info = await inspectImageForPortals(f);
        setPortalChecks(info);
      } catch {
        setPortalChecks(null);
      }
    }
  };

  const resetAll = () => {
    if (originalPreview) URL.revokeObjectURL(originalPreview);
    if (result?.url) URL.revokeObjectURL(result.url);
    revokeBatchPreviews(batchQueue);
    setBatchQueue([]);
    setFile(null);
    setOriginalPreview(null);
    setResult(null);
    setPassportResult(null);
    setPortalChecks(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleToggleBatch = (next: boolean) => {
    setBatchMode(next);
    setResult(null);
    setPassportResult(null);
    setError(null);
    if (next) {
      setDrawingMode(false);
      setBatchQueue(file ? createBatchQueueItems([file]) : []);
    } else {
      const firstFile = batchQueue[0]?.file || file;
      revokeBatchPreviews(batchQueue);
      setBatchQueue([]);
      setFile(firstFile || null);
      if (firstFile) {
        if (originalPreview) URL.revokeObjectURL(originalPreview);
        setOriginalPreview(URL.createObjectURL(firstFile));
      }
    }
  };

  const handleRemoveBatchItem = (id: string) => {
    const target = batchQueue.find((item) => item.id === id);
    if (target?.output?.previewUrl) URL.revokeObjectURL(target.output.previewUrl);
    const remaining = batchQueue.filter((item) => item.id !== id);
    setBatchQueue(remaining);
    setFile(remaining[0]?.file || null);
  };

  const getFileFromSignatureCanvas = async (): Promise<File> => {
    const c = sigCanvasRef.current!;
    const blob = await new Promise<Blob>((resolve) =>
      c.toBlob((b) => resolve(b!), 'image/png')
    );
    return new File([blob], 'drawn_signature.png', { type: 'image/png' });
  };

  const processSingleImageFile = async (activeFile: File): Promise<ImageProcessResult | null> => {
    switch (tool.engineId) {
      case 'image-compress':
      case 'image-strip-exif': {
        const mime =
          (tool.presetConfig?.forceMime as 'image/jpeg' | 'image/png' | 'image/webp') ||
          'image/jpeg';
        return await compressImage(
          activeFile,
          tool.engineId === 'image-strip-exif' ? 92 : qualityPct,
          maxWidthPx,
          mime
        );
      }
      case 'image-kb-compress':
        return await compressToExactKb(activeFile, targetKb);
      case 'image-resize':
        return await resizeImageExact(activeFile, resizeW, resizeH, 'image/jpeg');
      case 'image-crop': {
        const [aw, ah] = cropAspect.split(':').map(Number);
        return await cropImageAspect(activeFile, aw, ah);
      }
      case 'image-convert': {
        const mime =
          (tool.presetConfig?.targetMime as 'image/jpeg' | 'image/png' | 'image/webp') ||
          'image/jpeg';
        return await compressImage(activeFile, 92, 0, mime);
      }
      case 'image-bg-remove':
        return await removePhotoBackground(activeFile, bgTol, bgColor);
      case 'image-enhance':
      case 'document-scanner':
        return await enhanceOrScanImage(activeFile, {
          brightness,
          contrast,
          bwThreshold,
        });
      case 'image-dpi':
        return await setJpegDpi(activeFile, dpiValue);
      case 'signature-studio': {
        const cleaned = await whitenSignatureImage(activeFile, sigThreshold);
        const cleanedFile = new File([cleaned.blob], cleaned.filename, {
          type: 'image/jpeg',
        });
        return await compressToExactKb(cleanedFile, targetKb, 600);
      }
      case 'dimension-checker': {
        const info = await inspectImageForPortals(activeFile);
        setPortalChecks(info);
        return null;
      }
      default:
        throw new Error('Image engine not mapped.');
    }
  };

  const handleDownloadBatchZip = async (queueSnapshot = batchQueue) => {
    setZipBusy(true);
    try {
      const zip = await buildBatchZipBundle(queueSnapshot, tool.slug);
      triggerDownload(zip.blob, zip.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build ZIP archive.');
    } finally {
      setZipBusy(false);
    }
  };

  const handleProcess = async (autoDownload = false) => {
    if (batchMode) {
      if (batchQueue.length === 0) {
        setError('Please upload at least one image to process in batch.');
        return;
      }
      setProcessing(true);
      setError(null);
      setResult(null);
      const t0 = performance.now();

      try {
        const resetQueue = createBatchQueueItems(batchQueue.map((q) => q.file));
        revokeBatchPreviews(batchQueue);
        setBatchQueue(resetQueue);
        const updatedQueue = [...resetQueue];

        await runSimultaneousBatch(
          resetQueue,
          async (item) => {
            const converted = await processSingleImageFile(item.file);
            if (!converted) throw new Error('No output generated.');
            return {
              blob: converted.blob,
              filename: converted.filename,
              summary: converted.summary,
              previewUrl: converted.url,
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

        const doneCount = updatedQueue.filter((q) => q.status === 'done').length;
        if (doneCount === 0) {
          setError('All images in the batch failed to convert.');
        } else if (autoDownload) {
          await handleDownloadBatchZip(updatedQueue);
        }

        const totalBytes = resetQueue.reduce((acc, q) => acc + q.file.size, 0);
        await recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: doneCount > 0 ? 'completed' : 'failed',
          inputSummary: `Batch: ${resetQueue.length} image(s) (${(totalBytes / 1024).toFixed(1)} KB)`,
          outputSummary: `${doneCount}/${resetQueue.length} converted simultaneously`,
          durationMs: performance.now() - t0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Batch image processing failed.');
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (!file && !drawingMode) {
      setError('Please upload an image first.');
      return;
    }
    setProcessing(true);
    setError(null);
    const t0 = performance.now();

    try {
      const activeFile = drawingMode ? await getFileFromSignatureCanvas() : file!;
      if (tool.engineId === 'passport-photo') {
        const pRes = await generatePassportPhotoAndSheet(
          activeFile,
          passportPreset,
          sheetType,
          true
        );
        setPassportResult(pRes);
        if (autoDownload) {
          triggerDownload(pRes.pdfBlob, 'passport_print_sheet.pdf');
        }
        await recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: 'completed',
          inputSummary: activeFile.name,
          outputSummary: pRes.sheet.summary,
          durationMs: performance.now() - t0,
        });
        setProcessing(false);
        return;
      }

      const out = await processSingleImageFile(activeFile);

      if (out) {
        setResult(out);
        if (autoDownload) {
          triggerDownload(out.blob, out.filename);
        }
        await recordToolUsage({
          toolSlug: tool.slug,
          toolName: tool.name,
          status: 'completed',
          inputSummary: `${activeFile.name} (${(activeFile.size / 1024).toFixed(1)} KB)`,
          outputSummary: out.summary,
          durationMs: performance.now() - t0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  latestExportRef.current = async () => {
    if (batchMode) {
      const hasDone = batchQueue.some((q) => q.status === 'done' && q.output);
      if (hasDone) {
        await handleDownloadBatchZip(batchQueue);
        return;
      }
      if (batchQueue.length > 0) {
        await handleProcess(true);
        return;
      }
      inputRef.current?.click();
      return;
    }
    if (passportResult) {
      triggerDownload(passportResult.pdfBlob, 'passport_print_sheet.pdf');
      return;
    }
    if (result) {
      triggerDownload(result.blob, result.filename);
      return;
    }
    if (file || drawingMode) {
      await handleProcess(true);
      return;
    }
    inputRef.current?.click();
  };

  const hasReadyExport = Boolean(
    passportResult ||
      result ||
      file ||
      drawingMode ||
      batchQueue.length > 0
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

  // Signature draw pad handlers
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const rect = c.getBoundingClientRect();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * (c.width / rect.width), (e.clientY - rect.top) * (c.height / rect.height));
    setIsDrawing(true);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !sigCanvasRef.current) return;
    const c = sigCanvasRef.current;
    const ctx = c.getContext('2d')!;
    const rect = c.getBoundingClientRect();
    ctx.lineTo((e.clientX - rect.left) * (c.width / rect.width), (e.clientY - rect.top) * (c.height / rect.height));
    ctx.stroke();
  };
  const clearDraw = () => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
  };

  return (
    <div className="space-y-6">
      {canBatch && (
        <BatchModeToggle
          enabled={batchMode}
          onToggle={handleToggleBatch}
          queuedCount={batchQueue.length}
          disabled={processing}
        />
      )}

      {tool.engineId === 'signature-studio' && !batchMode && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDrawingMode(false)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
              !drawingMode ? 'border-[#F5C542] bg-[#F5C542]/15' : 'border-[#EAEAEA] dark:border-[#2C2C27]'
            }`}
          >
            Upload Paper Signature Photo
          </button>
          <button
            type="button"
            onClick={() => {
              setDrawingMode(true);
              setTimeout(clearDraw, 20);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
              drawingMode ? 'border-[#F5C542] bg-[#F5C542]/15' : 'border-[#EAEAEA] dark:border-[#2C2C27]'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Draw Signature</span>
          </button>
        </div>
      )}

      {drawingMode && !batchMode ? (
        <div className="space-y-2">
          <canvas
            ref={sigCanvasRef}
            width={600}
            height={200}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={() => setIsDrawing(false)}
            onPointerLeave={() => setIsDrawing(false)}
            className="w-full max-w-xl h-44 bg-white border border-[#EAEAEA] rounded-xl touch-none cursor-crosshair"
          />
          <button
            type="button"
            onClick={clearDraw}
            className="text-xs font-medium text-[#707070] hover:text-[#252525] underline cursor-pointer"
          >
            Clear Drawing Pad
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] rounded-xl p-8 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210] transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            multiple={batchMode}
            accept="image/*"
            onChange={(e) => handleFile(e.target.files)}
            className="hidden"
          />
          <Upload className="w-8 h-8 mx-auto text-[#707070] mb-3" />
          <p className="font-medium text-sm text-[#252525] dark:text-[#F4F3EE]">
            {batchMode
              ? batchQueue.length > 0
                ? `Click or drop to add more images (${batchQueue.length} queued)`
                : 'Upload multiple images for simultaneous processing'
              : file
              ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)`
              : 'Upload photo or signature image'}
          </p>
          <p className="text-xs text-[#707070] mt-1">
            Processed locally in browser RAM · Zero server storage
            {batchMode ? ' · Up to 25 images per batch' : ''}
          </p>
        </div>
      )}

      {batchMode && (
        <BatchResultsPanel
          items={batchQueue}
          processing={processing}
          zipBusy={zipBusy}
          onRemoveItem={handleRemoveBatchItem}
          onDownloadItem={(item) => {
            if (item.output) triggerDownload(item.output.blob, item.output.filename);
          }}
          onDownloadAllZip={() => void handleDownloadBatchZip(batchQueue)}
        />
      )}

      {/* Engine-Specific Controls */}
      {tool.engineId === 'image-kb-compress' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[20, 30, 50, 100, 200].map((kb) => (
              <button
                key={kb}
                type="button"
                onClick={() => setTargetKb(kb)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer tabular-nums ${
                  targetKb === kb ? 'border-[#F5C542] bg-[#F5C542]/15' : 'border-[#EAEAEA] dark:border-[#2C2C27]'
                }`}
              >
                {kb} KB
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Custom Target Size (KB)</label>
            <input
              type="number"
              min={5}
              max={5000}
              value={targetKb}
              onChange={(e) => setTargetKb(Number(e.target.value))}
              className="w-40 px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm tabular-nums"
            />
          </div>
        </div>
      )}

      {tool.engineId === 'image-compress' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">
              Quality ({qualityPct}%)
            </label>
            <input
              type="range"
              min={10}
              max={95}
              value={qualityPct}
              onChange={(e) => setQualityPct(Number(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1">
              Max Width (px, 0 = original)
            </label>
            <input
              type="number"
              value={maxWidthPx}
              onChange={(e) => setMaxWidthPx(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm tabular-nums"
            />
          </div>
        </div>
      )}

      {tool.engineId === 'image-resize' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'PAN Photo (213×213)', w: 213, h: 213 },
              { label: 'Passport (413×531)', w: 413, h: 531 },
              { label: 'SSC Photo (200×230)', w: 200, h: 230 },
              { label: 'Signature (140×60)', w: 140, h: 60 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setResizeW(p.w);
                  setResizeH(p.h);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-medium hover:border-[#F5C542] cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-xs text-[#707070] mb-1">Width (px)</label>
              <input
                type="number"
                value={resizeW}
                onChange={(e) => setResizeW(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#707070] mb-1">Height (px)</label>
              <input
                type="number"
                value={resizeH}
                onChange={(e) => setResizeH(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      {tool.engineId === 'image-crop' && (
        <div className="flex flex-wrap gap-2">
          {(['1:1', '35:45', '4:3', '3:1'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setCropAspect(ratio)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${
                cropAspect === ratio ? 'border-[#F5C542] bg-[#F5C542]/15' : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              Aspect {ratio}
            </button>
          ))}
        </div>
      )}

      {tool.engineId === 'image-bg-remove' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">
              Backdrop Tolerance ({bgTol})
            </label>
            <input
              type="range"
              min={15}
              max={95}
              value={bgTol}
              onChange={(e) => setBgTol(Number(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>
          <div className="flex items-end gap-2">
            {(
              [
                { id: '#FFFFFF', label: 'Pure White' },
                { id: '#DCEBFF', label: 'Passport Blue' },
                { id: 'transparent', label: 'Transparent PNG' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBgColor(opt.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  bgColor === opt.id ? 'border-[#F5C542] bg-[#F5C542]/15' : 'border-[#EAEAEA] dark:border-[#2C2C27]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(tool.engineId === 'image-enhance' || tool.engineId === 'document-scanner') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Brightness ({brightness})</label>
            <input
              type="range"
              min={-40}
              max={40}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Contrast ({contrast})</label>
            <input
              type="range"
              min={-30}
              max={45}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">
              Document B&W Cleanup ({bwThreshold === 0 ? 'Off' : bwThreshold})
            </label>
            <input
              type="range"
              min={0}
              max={210}
              value={bwThreshold}
              onChange={(e) => setBwThreshold(Number(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>
        </div>
      )}

      {tool.engineId === 'image-dpi' && (
        <div className="flex flex-wrap gap-2">
          {[150, 200, 300, 600].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDpiValue(d)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border cursor-pointer tabular-nums ${
                dpiValue === d ? 'border-[#F5C542] bg-[#F5C542]/15' : 'border-[#EAEAEA] dark:border-[#2C2C27]'
              }`}
            >
              {d} DPI
            </button>
          ))}
        </div>
      )}

      {tool.engineId === 'passport-photo' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1.5">Photo Standard</label>
            <select
              value={passportPreset}
              onChange={(e) => setPassportPreset(e.target.value as typeof passportPreset)}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-sm"
            >
              <option value="in-passport">India Passport (35×45 mm)</option>
              <option value="pan-card">PAN Card (25×35 mm)</option>
              <option value="us-visa">US / Schengen / Global Visa (2×2 in)</option>
              <option value="stamp">Stamp Size (20×25 mm)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#707070] mb-1.5">Print Sheet Size</label>
            <select
              value={sheetType}
              onChange={(e) => setSheetType(e.target.value as typeof sheetType)}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-sm"
            >
              <option value="4x6">4×6 inch Photo Paper (8-up)</option>
              <option value="a4">A4 Full Sheet (30-up)</option>
            </select>
          </div>
        </div>
      )}

      {tool.engineId === 'signature-studio' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">
              Paper Background Whitening ({sigThreshold})
            </label>
            <input
              type="range"
              min={110}
              max={220}
              value={sigThreshold}
              onChange={(e) => setSigThreshold(Number(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Target Max KB (10–20 KB typical)</label>
            <input
              type="number"
              min={5}
              max={200}
              value={targetKb}
              onChange={(e) => setTargetKb(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm tabular-nums"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleProcess(false)}
          disabled={processing}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm cursor-pointer disabled:opacity-60"
        >
          {processing && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {processing
              ? 'Processing...'
              : batchMode
              ? `Batch Convert ${batchQueue.length || ''} ${batchQueue.length === 1 ? 'Image' : 'Images'}`.trim()
              : `Run ${tool.name}`}
          </span>
        </button>

        {(file || result || passportResult || batchQueue.length > 0) && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-sm font-medium cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-lg border border-[#F06455]/40 bg-[#F06455]/10 text-sm text-[#B91C1C] dark:text-[#FCA5A5]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Portal Dimension Checker Report */}
      {portalChecks && (
        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-3">
          <div className="text-sm font-semibold text-[#252525] dark:text-[#F4F3EE] tabular-nums">
            Measured File: {portalChecks.width} × {portalChecks.height} px · {portalChecks.sizeKb} KB
          </div>
          <div className="space-y-2">
            {portalChecks.checks.map((c) => (
              <div
                key={c.portal}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-[#1B1B18] border border-[#EAEAEA] dark:border-[#2C2C27] text-xs"
              >
                <div>
                  <div className="font-semibold text-[#252525] dark:text-[#F4F3EE]">{c.portal}</div>
                  <div className="text-[#707070] tabular-nums">{c.detail}</div>
                </div>
                <span
                  className={`font-semibold ${
                    c.pass ? 'text-[#16A34A]' : 'text-[#D97706]'
                  }`}
                >
                  {c.pass ? 'PASS' : 'NEEDS RESIZE'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Image Output */}
      {result && (
        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#16A34A]">
                <CheckCircle2 className="w-4 h-4" />
                <span>{result.summary}</span>
              </div>
              <p className="text-xs text-[#707070] mt-1 tabular-nums">
                Dimensions: {result.width}×{result.height} px · Output Size: {result.sizeKb} KB
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerDownload(result.blob, result.filename)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#252525] dark:bg-[#F5C542] text-white dark:text-[#252525] font-semibold text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download {result.filename.split('.').pop()?.toUpperCase()}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {originalPreview && (
              <div className="p-3 rounded-lg bg-white dark:bg-[#1B1B18] border border-[#EAEAEA] dark:border-[#2C2C27]">
                <div className="text-xs font-medium text-[#707070] mb-2">Original</div>
                <img src={originalPreview} alt="Original" className="max-h-56 mx-auto object-contain" />
              </div>
            )}
            <div className="p-3 rounded-lg bg-white dark:bg-[#1B1B18] border border-[#EAEAEA] dark:border-[#2C2C27]">
              <div className="text-xs font-medium text-[#707070] mb-2">Processed Output</div>
              <img src={result.url} alt="Processed" className="max-h-56 mx-auto object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Passport Sheet Output */}
      {passportResult && (
        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#16A34A] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{passportResult.sheet.summary}</span>
              </div>
              <p className="text-xs text-[#707070] mt-1">{passportResult.single.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => triggerDownload(passportResult.single.blob, passportResult.single.filename)}
                className="px-3.5 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-xs font-semibold cursor-pointer"
              >
                Download Single JPG
              </button>
              <button
                type="button"
                onClick={() => triggerDownload(passportResult.sheet.blob, passportResult.sheet.filename)}
                className="px-3.5 py-2 rounded-lg bg-[#F5C542] text-[#252525] text-xs font-semibold cursor-pointer"
              >
                Download Sheet JPG
              </button>
              <button
                type="button"
                onClick={() => triggerDownload(passportResult.pdfBlob, 'passport_print_sheet.pdf')}
                className="px-3.5 py-2 rounded-lg bg-[#252525] text-white text-xs font-semibold cursor-pointer"
              >
                Download Print PDF
              </button>
            </div>
          </div>
          <img
            src={passportResult.sheet.url}
            alt="Passport photo print sheet"
            className="w-full max-h-96 object-contain rounded-lg border border-[#EAEAEA] bg-white p-2"
          />
        </div>
      )}
    </div>
  );
};
