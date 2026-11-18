import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Copy, Check, QrCode, ScanLine } from 'lucide-react';
import type { ToolDefinition } from '../../../types/tool';
import type { ToolExportShortcut } from '../../../lib/converterExport';
import { useToolTray as useAuth } from '../../../context/ToolTrayContext';
import {
  decodeQrFromImage,
  generateBarcodeDataUrl,
  generateQrCodeAssets,
  type QrPayload,
} from '../../../engines/qrBarcodeEngine';

export const QrBarcodeWorkspace: React.FC<{
  tool: ToolDefinition;
  onRegisterExportShortcut?: (shortcut: ToolExportShortcut | null) => void;
}> = ({ tool, onRegisterExportShortcut }) => {
  const { recordToolUsage } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const latestExportRef = useRef<() => Promise<void> | void>(() => {});

  const qrMode = (tool.presetConfig?.qrMode as QrPayload['mode']) || 'text';
  const [text, setText] = useState('https://ibakeweb.in');
  const [upiId, setUpiId] = useState('merchant@upi');
  const [payeeName, setPayeeName] = useState('Digital Tools Tray');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('Service Payment');
  const [phone, setPhone] = useState('919876543210');
  const [message, setMessage] = useState('Hello, I need help with document services.');
  const [ssid, setSsid] = useState('BakeWeb_Guest_WiFi');
  const [wifiPassword, setWifiPassword] = useState('seva@2026');
  const [wifiSecurity, setWifiSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [fullName, setFullName] = useState('Aarav Patel');
  const [org, setOrg] = useState('DIGITAL INDIA PROJECT');
  const [email, setEmail] = useState('contact@ibakeweb.in');
  const [darkColor, setDarkColor] = useState('#252525');

  const [barcodeVal, setBarcodeVal] = useState('BW-2026-00192');
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13' | 'CODE39' | 'UPC'>('CODE128');
  const [barcodeOut, setBarcodeOut] = useState<{ pngDataUrl: string; svgString: string } | null>(null);

  const [qrResult, setQrResult] = useState<{
    dataUrl: string;
    svgString: string;
    encodedText: string;
    pdfBlob: Blob;
  } | null>(null);
  const [decodedResults, setDecodedResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const downloadPdfBlob = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `${tool.slug}_standee.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  };

  const handleGenerateQr = async (autoDownloadPdf = false) => {
    setError(null);
    try {
      const res = await generateQrCodeAssets({
        mode: qrMode,
        text,
        upiId,
        payeeName,
        amount,
        note,
        phone,
        message,
        ssid,
        wifiPassword,
        wifiSecurity,
        fullName,
        org,
        email,
        darkColor,
      });
      setQrResult(res);
      if (autoDownloadPdf) {
        downloadPdfBlob(res.pdfBlob);
      }
      await recordToolUsage({
        toolSlug: tool.slug,
        toolName: tool.name,
        status: 'completed',
        inputSummary: qrMode.toUpperCase(),
        outputSummary: res.encodedText.slice(0, 80),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code.');
    }
  };

  latestExportRef.current = async () => {
    if (qrResult?.pdfBlob) {
      downloadPdfBlob(qrResult.pdfBlob);
      return;
    }
    await handleGenerateQr(true);
  };

  useEffect(() => {
    onRegisterExportShortcut?.({
      ready: true,
      onExport: () => latestExportRef.current(),
    });
    return () => {
      onRegisterExportShortcut?.(null);
    };
  }, [onRegisterExportShortcut, tool.slug]);

  const handleGenerateBarcode = () => {
    setError(null);
    try {
      const out = generateBarcodeDataUrl(barcodeVal, barcodeFormat);
      setBarcodeOut(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid characters or length for selected barcode standard.');
    }
  };

  const handleScanImage = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setError(null);
    try {
      const codes = await decodeQrFromImage(files[0]);
      if (!codes.length) {
        setError('No readable QR code detected in the uploaded image.');
      }
      setDecodedResults(codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decode image.');
    }
  };

  if (tool.engineId === 'qr-scanner') {
    return (
      <div className="space-y-6">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-[#EAEAEA] dark:border-[#2C2C27] hover:border-[#F5C542] rounded-xl p-8 text-center cursor-pointer bg-[#FAFAF7] dark:bg-[#121210]"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleScanImage(e.target.files)}
            className="hidden"
          />
          <ScanLine className="w-8 h-8 mx-auto text-[#707070] mb-3" />
          <p className="font-medium text-sm">Upload QR or Barcode image to decode locally</p>
          <p className="text-xs text-[#707070] mt-1">Supports JPG, PNG, WebP screenshots</p>
        </div>

        {error && <p className="text-sm text-[#F06455]">{error}</p>}

        {decodedResults.length > 0 && (
          <div className="p-4 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] space-y-2">
            <div className="text-xs font-semibold text-[#16A34A]">Decoded Content</div>
            {decodedResults.map((val, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#1B1B18] rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27]">
                <code className="text-xs font-mono break-all">{val}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(val);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="p-1.5 rounded border border-[#EAEAEA] dark:border-[#2C2C27] cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-[#16A34A]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tool.engineId === 'barcode-generator') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-xs text-[#707070] mb-1">Barcode Value</label>
            <input
              type="text"
              value={barcodeVal}
              onChange={(e) => setBarcodeVal(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#707070] mb-1">Symbology</label>
            <select
              value={barcodeFormat}
              onChange={(e) => setBarcodeFormat(e.target.value as typeof barcodeFormat)}
              className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-sm"
            >
              <option value="CODE128">CODE128 (Alphanumeric)</option>
              <option value="EAN13">EAN-13 (12–13 digits)</option>
              <option value="UPC">UPC-A (11–12 digits)</option>
              <option value="CODE39">CODE39</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerateBarcode}
          className="px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm cursor-pointer"
        >
          Generate Barcode
        </button>
        {error && <p className="text-sm text-[#F06455]">{error}</p>}
        {barcodeOut && (
          <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-white inline-block space-y-3">
            <img src={barcodeOut.pngDataUrl} alt="Generated barcode" className="max-w-full" />
            <div className="flex gap-2">
              <a
                href={barcodeOut.pngDataUrl}
                download={`${barcodeVal}.png`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#252525] text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {qrMode === 'upi' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs text-[#707070] mb-1">UPI ID (VPA)</label><input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@okaxis" className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Payee / Shop Name</label><input type="text" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Fixed Amount INR (optional)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Leave blank for open amount" className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Transaction Note</label><input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        </div>
      )}

      {qrMode === 'whatsapp' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs text-[#707070] mb-1">WhatsApp Number (with country code)</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Pre-filled Message</label><input type="text" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        </div>
      )}

      {qrMode === 'wifi' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="block text-xs text-[#707070] mb-1">Wi-Fi Name (SSID)</label><input type="text" value={ssid} onChange={(e) => setSsid(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Password</label><input type="text" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Encryption</label><select value={wifiSecurity} onChange={(e) => setWifiSecurity(e.target.value as 'WPA' | 'WEP' | 'nopass')} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-sm"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">Open</option></select></div>
        </div>
      )}

      {qrMode === 'vcard' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs text-[#707070] mb-1">Full Name</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Organization / Shop</label><input type="text" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Phone</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
          <div><label className="block text-xs text-[#707070] mb-1">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm" /></div>
        </div>
      )}

      {(qrMode === 'text' || qrMode === 'url' || qrMode === 'standee') && (
        <div className="space-y-3">
          <label className="block text-xs text-[#707070]">URL or Text Content</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://example.com or text"
            className="w-full px-3 py-2.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-transparent text-sm"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#707070]">QR Color:</span>
          <input type="color" value={darkColor} onChange={(e) => setDarkColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
        </div>
        <button
          type="button"
          onClick={() => void handleGenerateQr(false)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5C542] hover:bg-[#FFD65A] text-[#252525] font-semibold text-sm cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Generate QR Code</span>
        </button>
      </div>

      {qrResult && (
        <div className="p-5 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] flex flex-col sm:flex-row items-center gap-6">
          <img src={qrResult.dataUrl} alt="Generated QR Code" className="w-44 h-44 rounded-lg bg-white p-2 border border-[#EAEAEA]" />
          <div className="space-y-3 flex-1 min-w-0">
            <div className="text-xs font-mono text-[#707070] break-all">{qrResult.encodedText}</div>
            <div className="flex flex-wrap gap-2">
              <a
                href={qrResult.dataUrl}
                download={`${tool.slug}.png`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#252525] text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  const u = URL.createObjectURL(qrResult.pdfBlob);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = `${tool.slug}_standee.pdf`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(u), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Printable A4 PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
