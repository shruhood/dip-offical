import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Application, ApplicationStatus } from '../../types';
import { issueSignedFileDownloadUrl, uploadFileToR2 } from '../../services/backendApi';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  ShieldCheck,
} from 'lucide-react';
import { InlineSkeletonPulse, TrackingResultSkeleton } from '../common/SkeletonLoaders';
import { trackInteraction } from '../../lib/perfMonitor';

interface TrackingWidgetProps {
  initialAppId?: string;
  onNavigateToApply?: () => void;
}

export const TrackingWidget: React.FC<TrackingWidgetProps> = ({ initialAppId = '', onNavigateToApply }) => {
  const { trackApplication, uploadAdditionalDocument } = useData();
  const [appId, setAppId] = useState(initialAppId);
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId.trim()) {
      setError('Please enter your Application ID (e.g. DIP-2026-XXXXX)');
      return;
    }
    if (!contact.trim()) {
      setError('Please enter your registered mobile number or email address');
      return;
    }

    setLoading(true);
    setError(null);
    trackInteraction('tracking', 'lookup_application', appId.trim());

    try {
      const res = await trackApplication(appId, contact);
      if (res.success && res.data) {
        setApplication(res.data);
        setError(null);
      } else {
        setApplication(null);
        setError(res.error || 'Verification failed. Please check your credentials.');
      }
    } catch {
      setApplication(null);
      setError('Unable to reach verification ledger. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application || !newDocFile) return;
    setUploadSubmitting(true);
    setUploadError(null);

    try {
      const uploadRes = await uploadFileToR2({
        file: newDocFile,
        bucket: 'dip-customer-uploads',
        applicationId: application.id,
        documentCategory: 'reupload_proof',
      });

      if (!uploadRes.ok || !uploadRes.data) {
        setUploadError(uploadRes.message || 'File validation failed. Upload a valid PDF, JPG, or PNG file.');
        return;
      }

      const fileId = String(uploadRes.data.id || uploadRes.data.fileId || '');
      const downloadEndpoint = uploadRes.data.downloadEndpoint || (fileId ? `/api/storage/files/${fileId}/download` : undefined);

      await uploadAdditionalDocument(application.id, {
        applicationId: application.id,
        documentType: 'Additional Requested Proof',
        fileName: newDocFile.name,
        fileSize: newDocFile.size,
        mimeType: newDocFile.type || 'application/pdf',
        fileId,
        logicalBucket: uploadRes.data.logicalBucket || 'dip-customer-uploads',
        r2ObjectKey: uploadRes.data.objectKey || uploadRes.data.r2ObjectKey,
        fileUrl: downloadEndpoint || `/api/storage/files/${fileId}`,
      });

      setUploadSuccess(true);
      setTimeout(async () => {
        setUploadOpen(false);
        setNewDocFile(null);
        setUploadSuccess(false);
        const refreshed = await trackApplication(appId, contact);
        if (refreshed.data) setApplication(refreshed.data);
      }, 900);
    } catch (err: any) {
      setUploadError(err?.message || 'Document upload failed.');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'Completed':
        return { bg: 'bg-[#EAF7EC]', text: 'text-[#138808]', border: 'border-[#138808]/20', icon: CheckCircle2 };
      case 'Application Processing':
      case 'Submitted to External Authority':
        return { bg: 'bg-[#FFF5EE]', text: 'text-[#FF671F]', border: 'border-[#FF671F]/30', icon: Clock };
      case 'Documents Required':
        return { bg: 'bg-[#FEF2F2]', text: 'text-[#E53935]', border: 'border-[#E53935]/30', icon: AlertTriangle };
      case 'Document Verification':
      case 'Under Review':
        return { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FFC928]/40', icon: Clock };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: Clock };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="bg-[#FFFDF8] px-6 py-5 border-b border-[#E5E7EB]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#FF671F]">
              <ShieldCheck className="w-4 h-4 text-[#138808]" />
              <span>Unified Application Tracker</span>
            </div>
            <h3 className="text-xl font-bold text-[#202124] mt-0.5">
              Track Your Application Progress
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Works for Online B2C, B2B Portal, Operator Desk, and Form Intake IDs using your registered mobile or email.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6">
        <form onSubmit={handleTrack} className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Application ID *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. DIP-2026-XXXXX"
                value={appId}
                onChange={(e) => setAppId(e.target.value.toUpperCase())}
                className="w-full bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-xs text-[#202124] font-medium placeholder-slate-400 focus:bg-white focus:border-[#FF671F] focus:outline-none transition uppercase"
                required
              />
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Mobile / Email *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="9876543210 or email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-xs text-[#202124] font-medium placeholder-slate-400 focus:bg-white focus:border-[#FF671F] focus:outline-none transition"
                required
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm hover:shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <InlineSkeletonPulse />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Track Application</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
              <p className="text-[11px] text-red-500 mt-0.5">
                Verify your Application ID and the exact mobile number or email registered at submission time.
              </p>
            </div>
          </div>
        )}

        {loading && <TrackingResultSkeleton />}

        {/* Verified Application Result */}
        {!loading && application && (
          <div className="mt-6 border-t border-[#E5E7EB] pt-6 space-y-6 animate-fadeIn">
            {/* Top Summary Bar */}
            <div className="p-4 bg-[#F7F8FA] rounded-xl border border-[#E5E7EB] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#FF671F]">{application.id}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs font-semibold text-slate-800">{application.serviceName}</span>
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                  <span>Applicant: <strong className="text-slate-700">{application.userName}</strong></span>
                  <span>Submitted: <strong className="text-slate-700">{new Date(application.submissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                  <span>Payment: <strong className="text-[#138808]">Paid (₹{application.payment.totalAmount})</strong></span>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {(() => {
                  const b = getStatusBadge(application.status);
                  const Icon = b.icon;
                  return (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${b.bg} ${b.text} ${b.border}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{application.status}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Operator Remarks / Action callout */}
            {application.customerRemarks && (
              <div className="p-4 rounded-xl border bg-white border-amber-200 shadow-xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Latest Operations Desk Remark:</span>
                    <span className="text-[10px] text-slate-400">{new Date(application.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {application.customerRemarks}
                  </p>

                  {/* If documents required, show button */}
                  {application.status === 'Documents Required' && (
                    <button
                      onClick={() => setUploadOpen(true)}
                      className="mt-2 inline-flex items-center gap-1.5 bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Required Document</span>
                    </button>
                  )}

                  {/* If completed, show certificate download */}
                  {application.status === 'Completed' && application.completionFileName && (
                    <button
                      type="button"
                      onClick={async () => {
                        const rawUrl = application.completionFileUrl || '';
                        if (rawUrl.startsWith('http') || rawUrl.startsWith('/api/')) {
                          const match = rawUrl.match(/\/api\/storage\/files\/([^/]+)/);
                          if (match?.[1]) {
                            const signed = await issueSignedFileDownloadUrl(match[1]);
                            if (signed.ok && signed.data?.downloadUrl) {
                              window.open(signed.data.downloadUrl, '_blank', 'noopener,noreferrer');
                              return;
                            }
                          }
                          window.open(rawUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      disabled={!application.completionFileUrl || application.completionFileUrl.startsWith('#')}
                      className="mt-2 inline-flex items-center gap-1.5 bg-[#138808] hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {application.completionFileName}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Upload Modal Drawer */}
            {uploadOpen && (
              <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">Upload Requested Supporting Document</h4>
                  <button onClick={() => setUploadOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">Cancel</button>
                </div>
                {uploadError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] font-semibold text-red-700">
                    {uploadError}
                  </div>
                )}
                <form onSubmit={handleUploadSubmit} className="space-y-3">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#FF671F] file:text-white hover:file:bg-[#E55B1B] cursor-pointer"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!newDocFile || uploadSubmitting}
                    className="bg-[#138808] hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {uploadSubmitting ? 'Validating & Uploading...' : uploadSuccess ? 'Document Uploaded Successfully!' : 'Confirm & Upload'}
                  </button>
                </form>
              </div>
            )}

            {/* Step-by-Step Progress Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Application Lifecycle Timeline
              </h4>
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-5 py-2">
                {application.statusHistory.map((item, idx) => (
                  <div key={item.id} className="relative pl-6">
                    {/* Circle marker */}
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-[#FF671F] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF671F]"></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-xs font-bold text-slate-800">{item.newStatus}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {item.customerMessage}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Updated by: {item.updatedBy} ({item.updatedByRole})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submitted documents overview */}
            <div className="border-t border-[#E5E7EB] pt-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Submitted Supporting Documents</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {application.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate">{doc.documentType}</div>
                        <div className="text-[10px] text-slate-500 truncate">{doc.fileName}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      doc.verificationStatus === 'Verified' ? 'bg-green-100 text-[#138808]' :
                      doc.verificationStatus === 'Re-upload Requested' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {doc.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
