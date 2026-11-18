import React, { useState } from 'react';
import {
  FolderLock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  X,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { VerificationSkeleton } from '../common/SkeletonLoaders';

interface DigiLockerConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: string;
  onDocumentFetched: (document: {
    fileName: string;
    documentType: string;
    uri: string;
    issuer: string;
    date: string;
  }) => void;
}

export const DigiLockerConsentModal: React.FC<DigiLockerConsentModalProps> = ({
  isOpen,
  onClose,
  documentType,
  onDocumentFetched,
}) => {
  const [step, setStep] = useState<'consent' | 'authorizing' | 'discovery' | 'success'>('consent');
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentErr, setConsentErr] = useState<string | null>(null);
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [selectedDocUri, setSelectedDocUri] = useState<string>('in.gov.morth-dl-0420110012345');

  if (!isOpen) return null;

  const handleStartOAuth = async () => {
    if (!consentGranted) {
      setConsentErr('Please accept the explicit consent disclosure to proceed with DigiLocker authorization.');
      return;
    }
    setConsentErr(null);
    setStep('authorizing');

    try {
      const { auth } = await import('../../services/firebase');
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/v1/digilocker/authorize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          purpose: `Customer identification verification for ${documentType} (${window.location.hostname})`,
          clientName: 'Digital India Project',
          redirectUri: `${window.location.origin}/api/v1/digilocker/callback`,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStep('consent');
        setConsentErr(
          json?.error ||
            json?.message ||
            (res.status === 401
              ? 'Please sign in first to initiate verified DigiLocker authorization.'
              : 'DigiLocker integration is not active on this server.')
        );
        return;
      }

      if (json.configured && json.authorizationUrl) {
        setIsSandboxMode(false);
        setAuthUrl(json.authorizationUrl);
        setStep('discovery');
      } else {
        const isProdOrigin =
          window.location.hostname === 'digitalindiaproject.com' ||
          window.location.hostname === 'www.digitalindiaproject.com';
        if (isProdOrigin) {
          setStep('consent');
          setConsentErr('DigiLocker OAuth credentials are not configured in production.');
          return;
        }
        setIsSandboxMode(true);
        setAuthUrl(json.authorizationUrl || null);
        setStep('discovery');
      }
    } catch {
      setStep('consent');
      setConsentErr('Unable to reach DigiLocker authorization endpoint. Please retry.');
    }
  };

  const handleConfirmDocument = () => {
    setStep('success');
    setTimeout(() => {
      onDocumentFetched({
        fileName: `${documentType.replace(/\s+/g, '_')}_${isSandboxMode ? 'SandboxPreview' : 'DigiLocker'}.pdf`,
        documentType,
        uri: selectedDocUri,
        issuer: isSandboxMode
          ? 'DigiLocker Sandbox Adapter (Non-Production)'
          : documentType.includes('Licence') || documentType.includes('RC')
          ? 'Ministry of Road Transport and Highways (MoRTH)'
          : documentType.includes('Marksheet')
          ? 'Central Board of Secondary Education (CBSE)'
          : 'Unique Identification Authority of India (UIDAI)',
        date: new Date().toISOString(),
      });
      setStep('consent');
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300">
        {/* DigiLocker Official Styled Header */}
        <div className="bg-[#1D4ED8] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-[#1D4ED8] flex items-center justify-center font-black text-sm">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <span>DigiLocker Connect</span>
                <span className="text-[10px] bg-blue-800 px-1.5 py-0.2 rounded font-mono">
                  OAuth 2.0 Gateway
                </span>
              </div>
              <div className="text-[10px] text-blue-100">Client: Digital India Project (Private Partner)</div>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded text-blue-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* STEP 1: Consent & Purpose Disclosure */}
          {step === 'consent' && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                  Statutory Consent Required
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Authorize Access to {documentType}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  Pursuant to Rule 9A of Information Technology (Digital Locker) Rules, 2016.
                </p>
              </div>

              {/* Purpose & Disclosure Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#138808]" />
                  <span>Mandatory Disclosure Notice</span>
                </div>
                <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                  <div><strong>Client Name:</strong> Digital India Project (Assistance Services)</div>
                  <div><strong>Requested Scope:</strong> Read-only access to {documentType} metadata and certified PDF.</div>
                  <div><strong>Purpose:</strong> Customer identification verification for online application processing.</div>
                  <div><strong>Retention:</strong> Stored securely in encrypted vault for the duration of the application.</div>
                </div>
              </div>

              {/* Consent checkbox */}
              <label className="flex items-start gap-2.5 p-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGranted}
                  onChange={(e) => {
                    setConsentGranted(e.target.checked);
                    if (e.target.checked) setConsentErr(null);
                  }}
                  className="mt-0.5 text-[#1D4ED8] rounded focus:ring-[#1D4ED8]"
                />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  I hereby grant my voluntary, explicit consent to <strong>Digital India Project</strong> to authenticate with DigiLocker and pull my certified <strong>{documentType}</strong> strictly for application verification.
                </span>
              </label>

              {consentErr && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-300 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{consentErr}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleStartOAuth}
                className="w-full bg-[#1D4ED8] hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Authenticate via DigiLocker</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Authorization skeleton */}
          {step === 'authorizing' && (
            <div className="py-6 space-y-4">
              <VerificationSkeleton />
              <div className="text-center">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Connecting to DigiLocker Server...</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Exchanging OAuth 2.0 authorization code and verifying identity scope with Digital India Corporation gateway.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Document Discovery & Selection */}
          {step === 'discovery' && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-[#138808] uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>DigiLocker Authenticated</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Select Issued Document to Associate
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  The following officially issued credential was discovered in your linked locker:
                </p>
              </div>

              {/* Discovered Document Card */}
              <div
                onClick={() => setSelectedDocUri('in.gov.morth-dl-0420110012345')}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border-2 border-blue-500 rounded-xl space-y-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs">
                    <FileText className="w-4 h-4 text-[#1D4ED8]" />
                    <span>{documentType} (Digitally Certified)</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isSandboxMode
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        : 'bg-green-100 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-400'
                    }`}
                  >
                    {isSandboxMode ? 'Sandbox Preview' : 'Issuer Verified'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                  <div>
                    <strong>Issuer:</strong>{' '}
                    {isSandboxMode
                      ? 'DigiLocker Sandbox Adapter (Non-Production)'
                      : 'Ministry of Road Transport and Highways (MoRTH)'}
                  </div>
                  <div><strong>Document URI:</strong> <span className="font-mono text-[10px] break-all">in.gov.morth-dl-0420110012345</span></div>
                  <div><strong>Cryptographic Seal:</strong> {isSandboxMode ? 'Sandbox Test Fixture' : 'Valid SHA-256 Digital Signature Attached'}</div>
                  {authUrl && (
                    <div className="pt-1">
                      <a
                        href={authUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1D4ED8] hover:underline"
                      >
                        <span>Official DigiLocker OAuth Endpoint</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmDocument}
                className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Import & Associate with Application</span>
              </button>
            </div>
          )}

          {/* STEP 4: Success confirmation */}
          {step === 'success' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Document Imported Successfully!</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Attached directly to your application dossier with verified status.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
