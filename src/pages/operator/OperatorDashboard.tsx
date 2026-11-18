import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ApplicationStatus } from '../../types';
import {
  CANONICAL_WORKFLOW_STATUSES,
  computeSlaHoursRemaining,
  validateStatusTransition,
} from '../../lib/workflow';
import { SwipeableActionItem } from '../../components/common/SwipeableActionItem';
import { issueSignedFileDownloadUrl, uploadFileToR2 } from '../../services/backendApi';
import {
  Shield,
  FileCheck,
  CheckCircle2,
  Upload,
  FileText,
  Lock,
  PlusCircle,
  X,
  UserCheck,
  ArrowRight,
  Clock,
  AlertTriangle,
  Download,
  Wrench,
  Crown,
  FlaskConical,
} from 'lucide-react';
import { useToolTray } from '../../context/ToolTrayContext';
import { SandboxWebhookTestModal } from '../../components/payment/SandboxWebhookTestModal';

const SOURCE_LABELS: Record<string, string> = {
  web_b2c: 'Web B2C',
  operator_assisted: 'Operator Desk',
  b2b_portal: 'B2B Portal',
  google_forms: 'Google Forms',
  admin_manual: 'Admin Manual',
};

export const OperatorDashboard: React.FC<{
  initialTab?: string;
  onNavigate: (route: string, param?: string) => void;
}> = ({ initialTab = 'queue', onNavigate }) => {
  const { user } = useAuth();
  const { planDefinition, activeSingleUsePassList, setTrayOpen } = useToolTray();
  const {
    services,
    applications,
    createApplication,
    updateApplicationStatus,
    verifyDocument,
    uploadCompletionDocument,
  } = useData();

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('Document Verification');
  const [customerRemark, setCustomerRemark] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [completionFileName, setCompletionFileName] = useState('');
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [completionUploading, setCompletionUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Assisted Walk-In Intake Modal State
  const [intakeOpen, setIntakeOpen] = useState(initialTab === 'intake');
  const [sandboxTestOpen, setSandboxTestOpen] = useState(initialTab === 'test-payment');

  useEffect(() => {
    if (initialTab === 'intake') {
      setIntakeOpen(true);
    } else if (initialTab === 'test-payment') {
      setSandboxTestOpen(true);
    }
  }, [initialTab]);
  const [intakeServiceSlug, setIntakeServiceSlug] = useState(services[0]?.slug || 'pan-card');
  const [citizenName, setCitizenName] = useState('');
  const [citizenMobile, setCitizenMobile] = useState('');
  const [citizenEmail, setCitizenEmail] = useState('');
  const [intakeFields, setIntakeFields] = useState<Record<string, any>>({});
  const [intakeProofName, setIntakeProofName] = useState('');
  const [intakeProofFile, setIntakeProofFile] = useState<File | null>(null);
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  const isAuthorizedOperator =
    user &&
    (user.role === 'operator' ||
      user.role === 'manager' ||
      user.role === 'admin' ||
      user.role === 'super_admin');

  if (!isAuthorizedOperator) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
          <Lock className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900">Operator KYC Approval Required</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Access to the Operator Desk & Walk-In Intake queue requires an approved Operator KYC dossier.
            {user?.kycStatus ? (
              <span className="block mt-2 font-bold text-slate-900">
                Current KYC Status: {user.kycStatus}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('operator-enroll')}
              className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>{user?.kycStatus && user.kycStatus !== 'Not Submitted' ? 'Check KYC Dossier' : 'Complete Operator KYC'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Customer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Strict Operator Queue Isolation: operators see only their assigned or self-collected applications (Managers/Admins see all)
  const operatorApps = applications.filter(
    (a) =>
      a.assignedOperatorId === user.id ||
      a.collectedByUid === user.id ||
      user.role === 'manager' ||
      user.role === 'admin' ||
      user.role === 'super_admin'
  );

  const selectedApp = operatorApps.find((a) => a.id === selectedAppId) || null;
  const intakeService = services.find((s) => s.slug === intakeServiceSlug) || services[0];

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setErrorMsg(null);

    const res = await updateApplicationStatus(
      selectedApp.id,
      newStatus,
      customerRemark || `Status updated to ${newStatus} by Operations desk.`,
      internalNote,
      user.name || 'Operations Officer',
      user.role
    );

    if (!res.ok) {
      setErrorMsg(res.error || 'Transition rejected by workflow rules.');
      return;
    }

    setCustomerRemark('');
    setInternalNote('');
    setSuccessMsg(`Status updated to "${newStatus}" successfully.`);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDocVerify = async (
    docId: string,
    status: 'Verified' | 'Rejected' | 'Re-upload Requested',
    reason?: string
  ) => {
    if (!selectedApp) return;
    await verifyDocument(selectedApp.id, docId, status, reason);
    setRejectingDocId(null);
    setRejectionReason('');

    if (status === 'Re-upload Requested') {
      await updateApplicationStatus(
        selectedApp.id,
        'Documents Required',
        `Action Required: Document re-upload requested: ${reason || 'Document is unclear or outdated.'}`,
        `Document ${docId} rejected by operator: ${reason}`,
        user.name || 'Operations Officer',
        'operator'
      );
    }

    setSuccessMsg(`Document marked as ${status}.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleUploadCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || (!completionFileName.trim() && !completionFile)) return;
    setCompletionUploading(true);
    setErrorMsg(null);

    try {
      const finalName = completionFile?.name || completionFileName.trim();
      let finalUrl = '';
      if (completionFile) {
        const upRes = await uploadFileToR2({
          file: completionFile,
          bucket: 'dip-generated-files',
          applicationId: selectedApp.id,
          documentCategory: 'completion_certificate',
          customerId: selectedApp.userId,
        });
        if (!upRes.ok || !upRes.data) {
          setErrorMsg(upRes.message || 'Invalid completion file format. Upload a valid PDF or image.');
          return;
        }
        const fid = String(upRes.data.id || upRes.data.fileId || '');
        finalUrl = upRes.data.downloadEndpoint || (fid ? `/api/storage/files/${fid}/download` : '');
      }

      if (!finalUrl) {
        setErrorMsg('Please attach the issued certificate PDF/image file to upload securely to R2.');
        return;
      }

      await uploadCompletionDocument(selectedApp.id, finalName, finalUrl);
      setCompletionFileName('');
      setCompletionFile(null);
      setSuccessMsg('Final completion certificate uploaded to R2 and application marked Completed.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } finally {
      setCompletionUploading(false);
    }
  };

  const handleWalkInIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenName.trim() || !citizenMobile.trim()) return;

    setIntakeSubmitting(true);
    setErrorMsg(null);
    try {
      let uploadedFileId: string | undefined;
      let uploadedBucket: string | undefined;
      let uploadedKey: string | undefined;
      let uploadedUrl: string | undefined;

      if (intakeProofFile) {
        const up = await uploadFileToR2({
          file: intakeProofFile,
          bucket: 'dip-customer-uploads',
          documentCategory: 'walkin_proof_bundle',
          customerId: user.id,
        });
        if (!up.ok || !up.data) {
          setErrorMsg(up.message || 'Uploaded proof file failed security validation.');
          return;
        }
        uploadedFileId = String(up.data.id || up.data.fileId || '');
        uploadedBucket = up.data.logicalBucket || 'dip-customer-uploads';
        uploadedKey = up.data.objectKey || up.data.r2ObjectKey;
        uploadedUrl = up.data.downloadEndpoint || (uploadedFileId ? `/api/storage/files/${uploadedFileId}/download` : undefined);
      }

      const created = await createApplication(
        intakeService.slug,
        {
          ...intakeFields,
          full_name: citizenName.trim(),
          userMobile: citizenMobile.trim(),
          userEmail: citizenEmail.trim() || user.email,
        },
        [
          {
            documentType: intakeService.requiredDocs[0]?.name || 'Citizen KYC & Proof Bundle',
            fileName: intakeProofFile?.name || intakeProofName || `${citizenName.trim().replace(/\s+/g, '_')}_KYC.pdf`,
            fileSize: intakeProofFile?.size || 1024 * 620,
            mimeType: intakeProofFile?.type || 'application/pdf',
            fileId: uploadedFileId,
            logicalBucket: uploadedBucket,
            r2ObjectKey: uploadedKey,
            fileUrl: uploadedUrl,
          },
        ],
        {
          sourceChannel: 'operator_assisted',
          userId: user.id,
          collectedByUid: user.id,
          assignedOperatorId: user.id,
          assignedOperatorName: user.name,
        }
      );

      setIntakeOpen(false);
      setCitizenName('');
      setCitizenMobile('');
      setCitizenEmail('');
      setIntakeFields({});
      setIntakeProofName('');
      setIntakeProofFile(null);
      setSelectedAppId(created.id);
      setSuccessMsg(`Walk-in application ${created.id} collected and queued for tracking.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } finally {
      setIntakeSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#202124] to-[#1E293B] text-white p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFC928] uppercase tracking-wider">
            <Shield className="w-4 h-4 text-[#138808]" />
            <span>Digital India Project — Operations & Assisted Intake Desk</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-1">
            Operator Processing Queue ({operatorApps.length} Active Dossiers)
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Logged in as <strong>{user.name}</strong> · Verify citizen uploads or collect walk-in applications directly.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIntakeOpen(true)}
            className="bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Collect Walk-In Application</span>
          </button>

          <button
            type="button"
            onClick={() => setSandboxTestOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Test Payment</span>
          </button>

          {(user.role === 'admin' || user.role === 'super_admin') && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="text-xs font-bold text-blue-300 hover:text-white bg-blue-950 px-3 py-2 rounded-xl border border-blue-800 cursor-pointer"
            >
              Admin Panel →
            </button>
          )}
        </div>
      </div>

      {/* CSC Operator Digital Tools Desk */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
              <Wrench className="w-3.5 h-3.5" />
              <span>CSC Operator Tool Studio · {planDefinition.name}</span>
              {activeSingleUsePassList.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-[#138808] dark:text-emerald-300">
                  {activeSingleUsePassList.length} Active ₹10 Pass
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Fast walk-in utilities for passport photos, KB resizing, PDF KYC packs, OCR, and customer receipts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTrayOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#FF671F] transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Quick Tray</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tool-plans')}
              className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Plans &amp; ₹10 Pass</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { slug: 'csc-passport-photo-studio', label: 'CSC Passport Photo Studio' },
            { slug: 'passport-photo-print-sheet', label: 'A4 Photo Print Sheet' },
            { slug: 'photo-signature-size-reducer', label: '20-50KB Photo/Sign Resize' },
            { slug: 'pdf-document-pack-maker', label: 'PDF KYC Pack Maker' },
            { slug: 'customer-service-bill-generator', label: 'CSC Receipt Generator' },
            { slug: 'gst-invoice-generator', label: 'GST Invoice Maker' },
          ].map((tool) => (
            <button
              key={tool.slug}
              type="button"
              onClick={() => onNavigate('tool-detail', tool.slug)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer transition-colors"
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#138808]" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Queue + Processing Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Active Operations Queue</span>
              <span className="block text-[10px] text-slate-400 md:hidden">
                Swipe right to Inspect · Swipe left for Need Docs
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">{operatorApps.length} Total</span>
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {operatorApps.map((app) => {
              const sla = computeSlaHoursRemaining(app.slaTargetAt || app.submissionDate, app.slaTargetAt ? 0 : 72);
              const canRequestDocs = validateStatusTransition({
                fromStatus: app.status,
                toStatus: 'Documents Required',
                actorRole: user.role,
                reason: 'Documents verification clarification requested by operator.',
              }).valid;
              const isSelected = selectedApp?.id === app.id;
              return (
                <SwipeableActionItem
                  key={app.id}
                  onClick={() => setSelectedAppId(app.id)}
                  className={`rounded-xl border transition ${
                    isSelected
                      ? 'border-[#FF671F]'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                  contentClassName={
                    isSelected
                      ? 'bg-[#FFF5EE] dark:bg-orange-950/30'
                      : 'bg-white dark:bg-slate-900'
                  }
                  leftAction={{
                    label: 'Inspect Dossier',
                    shortLabel: 'Inspect',
                    icon: <FileCheck className="w-4 h-4" />,
                    tone: 'primary',
                    onAction: () => setSelectedAppId(app.id),
                  }}
                  rightAction={
                    canRequestDocs && app.status !== 'Documents Required'
                      ? {
                          label: 'Request Documents',
                          shortLabel: 'Need Docs',
                          icon: <AlertTriangle className="w-4 h-4" />,
                          tone: 'warning',
                          onAction: async () => {
                            setErrorMsg(null);
                            const res = await updateApplicationStatus(
                              app.id,
                              'Documents Required',
                              'Action Required: Please upload clearer or supporting documents.',
                              'Quick-flagged via Operator Queue swipe',
                              user.name || 'Operations Officer',
                              user.role
                            );
                            if (!res.ok) {
                              setErrorMsg(res.error || 'Could not update status.');
                            } else {
                              setSuccessMsg(`${app.id} flagged as Documents Required.`);
                              setTimeout(() => setSuccessMsg(null), 3000);
                            }
                          },
                        }
                      : {
                          label: 'Open Dossier',
                          shortLabel: 'Open',
                          icon: <ArrowRight className="w-4 h-4" />,
                          tone: 'neutral',
                          onAction: () => setSelectedAppId(app.id),
                        }
                  }
                >
                  <div className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition cursor-pointer text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#FF671F]">{app.id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {app.status}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{app.serviceName}</div>
                      <div className="text-[11px] text-slate-500">
                        Applicant: {app.userName} ({app.userMobile})
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 flex justify-between items-center pt-1 border-t border-slate-100/60 dark:border-slate-800">
                      <span>{SOURCE_LABELS[app.sourceChannel || 'web_b2c'] || 'Web B2C'}</span>
                      <span className={`inline-flex items-center gap-1 font-mono ${sla.isOverdue && app.status !== 'Completed' ? 'text-red-600 font-bold' : ''}`}>
                        <Clock className="w-3 h-3" />
                        {app.status === 'Completed' ? 'Done' : sla.label}
                      </span>
                    </div>
                  </div>
                </SwipeableActionItem>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          {selectedApp ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#FF671F]">{selectedApp.id}</span>
                    <span className="text-xs font-bold text-slate-800">· {selectedApp.serviceName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Applicant: <strong>{selectedApp.userName}</strong> | Mobile: {selectedApp.userMobile} |{' '}
                    Channel: <strong>{SOURCE_LABELS[selectedApp.sourceChannel || 'web_b2c']}</strong>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[10px] text-slate-400 block">Payment Received</span>
                  <span className="font-bold text-[#138808] font-mono">
                    ₹{selectedApp.payment.totalAmount} (Success)
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Applicant Form Snapshot
                </h3>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {Object.entries(selectedApp.formData).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-[10px] text-slate-400 capitalize block">{k.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-slate-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Document Verification Desk ({selectedApp.documents.length} Uploads)
                </h3>
                <div className="space-y-3">
                  {selectedApp.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-slate-900 block truncate">{doc.documentType}</span>
                            <span className="text-[11px] text-slate-400 truncate">{doc.fileName}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            doc.verificationStatus === 'Verified'
                              ? 'bg-green-100 text-[#138808]'
                              : doc.verificationStatus === 'Re-upload Requested'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {doc.verificationStatus}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                        {doc.fileId && (
                          <button
                            type="button"
                            onClick={async () => {
                              const signed = await issueSignedFileDownloadUrl(doc.fileId!);
                              if (signed.ok && signed.data?.downloadUrl) {
                                window.open(signed.data.downloadUrl, '_blank', 'noopener,noreferrer');
                              }
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] px-3 py-1 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDocVerify(doc.id, 'Verified')}
                          className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1 rounded-lg transition cursor-pointer"
                        >
                          Mark Verified
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingDocId(doc.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[11px] px-3 py-1 rounded-lg transition cursor-pointer"
                        >
                          Request Re-upload
                        </button>
                      </div>

                      {rejectingDocId === doc.id && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg space-y-2">
                          <input
                            type="text"
                            placeholder="Reason for re-upload (visible to customer)..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full bg-white border border-red-300 rounded px-2 py-1 text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setRejectingDocId(null)}
                              className="text-[11px] text-slate-500 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDocVerify(doc.id, 'Re-upload Requested', rejectionReason)}
                              className="bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded cursor-pointer"
                            >
                              Send Request
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-orange-50/40 border border-orange-200 rounded-xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Update Application Processing State
                </h3>

                <form onSubmit={handleStatusSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      New 14-Stage Lifecycle Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    >
                      {CANONICAL_WORKFLOW_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Customer-Visible Update Remark *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. NSDL Acknowledgment generated. Dispatch underway."
                      value={customerRemark}
                      onChange={(e) => setCustomerRemark(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Internal Operations Memo</label>
                    <input
                      type="text"
                      placeholder="Internal note..."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer"
                  >
                    Commit Status Transition
                  </button>
                </form>
              </div>

              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3 text-xs">
                <h3 className="font-bold text-slate-800">Upload Final Completion Document / Certificate (R2 Secured)</h3>
                <form onSubmit={handleUploadCompletion} className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Document Title (e.g. Udyam_Certificate.pdf)"
                      value={completionFileName}
                      onChange={(e) => setCompletionFileName(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setCompletionFile(f);
                        if (f && !completionFileName) setCompletionFileName(f.name);
                      }}
                      className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white file:text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={completionUploading || !completionFile}
                    className="bg-[#138808] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{completionUploading ? 'Uploading to R2...' : 'Upload to R2 & Complete'}</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-xs space-y-2">
              <FileCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">Select an application or collect a new walk-in intake</p>
              <p className="text-slate-400">
                Review uploaded proofs, update lifecycle milestones, or register a citizen request from your district center.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collect Walk-In Citizen Application Modal */}
      {intakeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                  Operator Assisted Channel
                </span>
                <h3 className="text-base font-black text-slate-900">Collect Walk-In Citizen Application</h3>
              </div>
              <button
                onClick={() => setIntakeOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWalkInIntakeSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Service / Product *</label>
                <select
                  value={intakeServiceSlug}
                  onChange={(e) => {
                    setIntakeServiceSlug(e.target.value);
                    setIntakeFields({});
                  }}
                  className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2.5 font-semibold"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name} (Total ₹{s.serviceCharge + s.govtFees})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Citizen Full Name *</label>
                  <input
                    type="text"
                    value={citizenName}
                    onChange={(e) => setCitizenName(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={citizenMobile}
                    onChange={(e) => setCitizenMobile(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Citizen Email</label>
                  <input
                    type="email"
                    placeholder="citizen@example.com"
                    value={citizenEmail}
                    onChange={(e) => setCitizenEmail(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Dynamic Service Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {intakeService.formFields.slice(0, 6).map((f) => (
                  <div key={f.id}>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {f.label} {f.required ? '*' : ''}
                    </label>
                    {f.type === 'select' && f.options ? (
                      <select
                        value={intakeFields[f.id] || ''}
                        onChange={(e) => setIntakeFields((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        required={f.required}
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                      >
                        <option value="">Select...</option>
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                        placeholder={f.placeholder || ''}
                        value={intakeFields[f.id] || ''}
                        onChange={(e) => setIntakeFields((prev) => ({ ...prev, [f.id]: e.target.value }))}
                        required={f.required}
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <label className="block font-bold text-slate-800">Attach Scanned Citizen Proof Bundle</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setIntakeProofFile(f);
                    setIntakeProofName(f?.name || '');
                  }}
                  className="w-full text-[11px] text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white file:font-semibold"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-[11px] text-slate-500">
                  Desk Fee Total: <strong className="text-slate-900 font-mono">₹{intakeService.serviceCharge + intakeService.govtFees}</strong>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIntakeOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={intakeSubmitting}
                    className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
                  >
                    {intakeSubmitting ? 'Recording Application...' : 'Submit & Generate Tracking ID'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <SandboxWebhookTestModal
        isOpen={sandboxTestOpen}
        onClose={() => setSandboxTestOpen(false)}
        channel="operator"
        actorName={user.name || 'Operator'}
        onVerified={(res) => {
          setSuccessMsg(
            `Sandbox webhook verified: ${res.orderId} -> ${res.persistedOrderStatus || res.firstDelivery.resolvedOrderStatus} (HTTP ${res.firstDelivery.httpStatus})`
          );
          setTimeout(() => setSuccessMsg(null), 5000);
        }}
      />
    </div>
  );
};
