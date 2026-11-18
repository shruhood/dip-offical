import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Upload, Copy, Check, Download, Loader2, AlertCircle } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import type { ToolExportShortcut } from '../../../lib/converterExport';
import { useToolTray as useAuth } from '../../../context/ToolTrayContext';
import { extractTextFromPdf, createPaginatedTextPdf } from '../../../engines/pdfEngine';

export const AiAssistantWorkspace: React.FC<{
  tool: ToolDefinition;
  onRegisterExportShortcut?: (shortcut: ToolExportShortcut | null) => void;
}> = ({ tool, onRegisterExportShortcut }) => {
  const { getIdToken, recordToolUsage } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const latestExportRef = useRef<() => Promise<void> | void>(() => {});

  const aiMode = (tool.presetConfig?.aiMode as string) || 'summarize';
  const [inputText, setInputText] = useState('');
  const [question, setQuestion] = useState('');
  const [sourceLang, setSourceLang] = useState((tool.presetConfig?.sourceLang as string) || 'Auto');
  const [targetLang, setTargetLang] = useState((tool.presetConfig?.targetLang as string) || 'Hindi');
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageMime, setImageMime] = useState<'image/jpeg' | 'image/png' | 'image/webp' | undefined>();
  const [uploadedName, setUploadedName] = useState<string>('');
  const [outputText, setOutputText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFile = async (selected: FileList | null) => {
    if (!selected?.[0]) return;
    const f = selected[0];
    setUploadedName(f.name);
    setError(null);
    setImageBase64(undefined);
    setImageMime(undefined);

    if (f.name.toLowerCase().endsWith('.pdf')) {
      try {
        const res = await extractTextFromPdf(f);
        setInputText(res.text.slice(0, 35000));
      } catch {
        setError('Could not read text from PDF. If it is a scanned photo PDF, upload a page image or run OCR first.');
      }
    } else if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const b64 = dataUrl.split(',')[1];
        setImageBase64(b64);
        const mime =
          f.type === 'image/png'
            ? 'image/png'
            : f.type === 'image/webp'
            ? 'image/webp'
            : 'image/jpeg';
        setImageMime(mime);
      };
      reader.readAsDataURL(f);
    } else {
      setInputText((await f.text()).slice(0, 35000));
    }
  };

  const handleRunAi = async (autoExportPdf = false) => {
    if (!inputText.trim() && !imageBase64) {
      setError('Enter text or upload a document/image to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    const t0 = performance.now();

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch('/api/v1/ai/process', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: aiMode,
          text: inputText,
          question,
          sourceLang,
          targetLang,
          imageBase64,
          imageMimeType: imageMime,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'AI request failed.');
      }
      const generated = data.outputText || '';
      setOutputText(generated);
      if (autoExportPdf && generated.trim()) {
        await exportPdf(generated);
      }
      await recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: uploadedName || `${inputText.slice(0, 50)}...`,
        outputSummary: `${generated.length} chars generated`,
        durationMs: performance.now() - t0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI service.');
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async (content = outputText) => {
    const res = await createPaginatedTextPdf(content || ' ', `${tool.slug}-output.pdf`, tool.name);
    const u = URL.createObjectURL(res.blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = res.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  };

  latestExportRef.current = async () => {
    if (outputText.trim()) {
      await exportPdf(outputText);
      return;
    }
    if (inputText.trim() || imageBase64) {
      await handleRunAi(true);
      return;
    }
    setError('Enter text or upload a document first before exporting.');
  };

  const hasReadyExport = Boolean(outputText.trim() || inputText.trim() || imageBase64);

  useEffect(() => {
    onRegisterExportShortcut?.({
      ready: hasReadyExport,
      onExport: () => latestExportRef.current(),
    });
    return () => {
      onRegisterExportShortcut?.(null);
    };
  }, [hasReadyExport, onRegisterExportShortcut, tool.slug]);

  return (
    <div className="space-y-5">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] rounded-xl p-6 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
          onChange={(e) => handleFile(e.target.files)}
          className="hidden"
        />
        <Upload className="w-6 h-6 mx-auto text-[#707070] mb-2" />
        <p className="text-sm font-medium">
          {uploadedName ? `Loaded: ${uploadedName}` : 'Optional: Upload PDF, TXT, or Document Photo'}
        </p>
      </div>

      {aiMode === 'translate' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Source Language</label>
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-sm">
              <option>Auto</option><option>English</option><option>Hindi</option><option>Gujarati</option><option>Marathi</option><option>Tamil</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Target Language</label>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-sm">
              <option>Hindi</option><option>Gujarati</option><option>English</option><option>Marathi</option><option>Tamil</option>
            </select>
          </div>
        </div>
      )}

      {aiMode === 'pdf-qa' && (
        <div>
          <label className="block text-xs text-[#707070] mb-1">Your Question About the Document</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What are the eligibility criteria and last submission date?"
            className="w-full px-3 py-2.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-[#707070] mb-1">
          Document Text / Prompt Details
        </label>
        <textarea
          rows={6}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste document text, notice, letter details, or upload a file above..."
          className="w-full rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent p-3.5 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleRunAi(false)}
        disabled={busy}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm cursor-pointer disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        <span>{busy ? 'Generating Response...' : `Run ${tool.name}`}</span>
      </button>

      <p className="text-xs text-[#707070]">
        Review all AI-generated drafts or extracted fields before official submission.
      </p>

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-lg border border-[#F06455]/40 bg-[#F06455]/10 text-sm text-[#B91C1C] dark:text-[#FCA5A5]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {outputText && (
        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#16A34A]">AI Output</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(outputText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] text-xs font-medium cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy</span>
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#252525] text-white text-xs font-medium cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#252525] dark:text-[#F4F3EE]">
            {outputText}
          </pre>
        </div>
      )}
    </div>
  );
};
