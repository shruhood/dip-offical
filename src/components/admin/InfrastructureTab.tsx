import React, { useEffect, useState } from 'react';
import {
  InfraOverviewResponse,
  createD1BackupToR2,
  deleteR2File,
  downloadD1BackupFile,
  enforceR2Retention,
  fetchAdminInfrastructure,
  issueSignedFileDownloadUrl,
  listR2Files,
  runInfrastructureHealthCheck,
  uploadFileToR2,
  verifyD1BackupInR2,
} from '../../services/backendApi';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileArchive,
  FolderLock,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const InfrastructureTab: React.FC = () => {
  const [infra, setInfra] = useState<InfraOverviewResponse | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedBucketFilter, setSelectedBucketFilter] = useState<string>('all');
  const [uploadTargetBucket, setUploadTargetBucket] = useState<string>('dip-public-assets');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [infraRes, filesRes] = await Promise.all([
        fetchAdminInfrastructure(),
        listR2Files({
          bucket: selectedBucketFilter === 'all' ? undefined : selectedBucketFilter,
          limit: 30,
        }),
      ]);

      if (infraRes.ok && infraRes.data) {
        setInfra(infraRes.data);
      } else {
        setErrorMessage(infraRes.message || 'Unable to load infrastructure telemetry.');
      }

      if (filesRes.ok && Array.isArray(filesRes.data)) {
        setFiles(filesRes.data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to contact /api/admin/infrastructure');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBucketFilter]);

  const handleHealthProbe = async () => {
    setProbing(true);
    setErrorMessage(null);
    try {
      const res = await runInfrastructureHealthCheck();
      if (res.ok) {
        setStatusMessage(res.message);
        await loadData();
      } else {
        setErrorMessage(res.message);
      }
    } finally {
      setProbing(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    setErrorMessage(null);
    try {
      const res = await createD1BackupToR2();
      if (res.ok) {
        setStatusMessage(res.message);
        await loadData();
      } else {
        setErrorMessage(res.message);
      }
    } finally {
      setBackingUp(false);
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    const res = await verifyD1BackupInR2(backupId);
    if (res.ok) {
      setStatusMessage(res.message);
      await loadData();
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMessage(null);
    try {
      const res = await uploadFileToR2({
        file,
        bucket: uploadTargetBucket,
        documentCategory: 'admin_console_upload',
      });
      if (res.ok) {
        setStatusMessage(res.message);
        await loadData();
      } else {
        setErrorMessage(res.message);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSignedDownload = async (fileId: string) => {
    const res = await issueSignedFileDownloadUrl(fileId);
    if (res.ok && res.data?.downloadUrl) {
      window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer');
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const res = await deleteR2File(fileId);
    if (res.ok) {
      setStatusMessage('Object deleted from R2 bucket and marked deleted in registry.');
      await loadData();
    } else {
      setErrorMessage(res.message);
    }
  };

  const r2UsagePercent = infra
    ? Math.min(
        100,
        Math.round(
          (infra.storage.totalBytesTrackedInRegistry /
            Math.max(1, infra.storage.freePlanLimits.freeStorageLimitBytes)) *
            1000
        ) / 10
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FF671F] uppercase tracking-wider">
            <Cloud className="w-4 h-4 shrink-0" />
            <span>Cloudflare Free-Plan Central Registry · digitalindiaproject.com</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            D1 Databases, R2 Storage Buckets &amp; Verified Backups
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Preserves live primary bindings (DB: dip-official · DOCUMENTS_BUCKET: dip-official) with logical 10-slot routing and Free-Tier quota guards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleHealthProbe}
            disabled={probing || loading}
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:opacity-90 transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            <span>{probing ? 'Probing...' : 'Run Health Check'}</span>
          </button>

          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={backingUp}
            className="px-4 py-2 bg-[#138808] hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>{backingUp ? 'Exporting...' : 'Create D1 Backup → R2'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const res = await enforceR2Retention(true);
              if (res.ok && res.data) {
                setStatusMessage(
                  `Retention Dry Run: scanned ${res.data.scannedCount} files; ${res.data.expiredCount} expired (0 deleted).`
                );
              } else {
                setErrorMessage(res.message || 'Retention scan unavailable in local preview.');
              }
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#FFC928]" />
            <span>Retention Dry Run</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const res = await enforceR2Retention(false);
              if (res.ok && res.data) {
                setStatusMessage(
                  `Retention Sweep Complete: purged ${res.data.deletedCount} expired R2 objects (${res.data.scannedCount} scanned).`
                );
                await loadData();
              } else {
                setErrorMessage(res.message || 'Retention purge failed.');
              }
            }}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Enforce Retention</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {infra && (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">D1 Slot Allocation</span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {infra.databases.physicalDatabasesBound} / {infra.databases.freePlanLimits.maxPhysicalDatabases} Physical DBs
              </div>
              <span className="text-[11px] text-[#138808] dark:text-emerald-400 font-semibold">
                {infra.storage.physicalBucketsBound} R2 buckets · Free Tier compliant
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                <span>R2 Storage Usage</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{r2UsagePercent}%</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatBytes(infra.storage.totalBytesTrackedInRegistry)} / 10 GB
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    infra.storage.quotaState === 'CRITICAL_STOP'
                      ? 'bg-red-600'
                      : infra.storage.quotaState === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-[#138808]'
                  }`}
                  style={{ width: `${Math.max(2, r2UsagePercent)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Tracked R2 Objects</span>
              <div className="text-xl font-black text-[#FF671F] font-mono">
                {infra.storage.totalFilesTrackedInRegistry} Files
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                10 logical bucket partitions active
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Worker Secrets Readiness</span>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {infra.secretsReadiness.aiProvidersConfiguredCount} AI ·{' '}
                {infra.secretsReadiness.authSigning ? 'HMAC OK' : 'HMAC Pending'}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Cashfree {infra.secretsReadiness.cashfreeGateway ? 'Ready' : 'Sandbox'} · DigiLocker{' '}
                {infra.secretsReadiness.digilocker ? 'Ready' : 'Sandbox'}
              </span>
            </div>
          </div>

          {/* D1 Database Registry Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#FF671F]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cloudflare D1 Database Registry (10-Slot Free-Plan Architecture)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Primary D1: dip-official
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Logical Domain</th>
                    <th className="py-2.5 px-4">Active Binding</th>
                    <th className="py-2.5 px-4">Modules</th>
                    <th className="py-2.5 px-4 text-right">Tables</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {infra.databases.databases.map((db) => (
                    <tr key={db.logicalName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-400">{db.slotNumber}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{db.logicalName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">{db.purpose}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {db.activeBinding}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-600 dark:text-slate-300">
                        {db.modules.join(' · ')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {db.ownedTablesCount}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[11px] font-bold ${
                            db.status === 'CONNECTED'
                              ? 'text-[#138808] dark:text-emerald-400'
                              : db.status === 'ERROR'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {db.status === 'CONNECTED'
                            ? `Connected (${db.latencyMs}ms)`
                            : db.status === 'UNCONFIGURED'
                            ? 'Dev Preview'
                            : 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* R2 Storage Buckets Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#FF671F]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cloudflare R2 Storage Registry (10 Purpose-Isolated Buckets)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Bound Buckets: {infra.storage.physicalBucketsBound} / 10 (10 GB shared Free Tier)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Bucket Slot</th>
                    <th className="py-2.5 px-4">Active Binding</th>
                    <th className="py-2.5 px-4">Access Policy</th>
                    <th className="py-2.5 px-4 text-right">Files</th>
                    <th className="py-2.5 px-4 text-right">Usage</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {infra.storage.buckets.map((b) => (
                    <tr key={b.logicalName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono text-slate-400">{b.slotNumber}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{b.logicalName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">{b.purpose}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <div>{b.activeBinding}</div>
                        <div className="text-[10px] text-slate-400">{b.prefix}/</div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold">
                        <span
                          className={
                            b.accessClassification === 'private'
                              ? 'text-[#FF671F]'
                              : b.accessClassification === 'public-read'
                              ? 'text-[#138808] dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }
                        >
                          {b.accessClassification}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">{b.fileCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{formatBytes(b.bytesUsed)}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[11px] font-bold ${
                            b.status === 'CONNECTED'
                              ? 'text-[#138808] dark:text-emerald-400'
                              : b.status === 'ERROR'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {b.status === 'CONNECTED'
                            ? 'Connected'
                            : b.status === 'UNCONFIGURED'
                            ? 'Dev Preview'
                            : 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* R2 File Registry & Upload Browser */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderLock className="w-4 h-4 text-[#FF671F]" />
                  <span>Central File Registry &amp; Secure R2 Upload Manager</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Private files require HMAC short-lived signed downloads; keys use UUIDs (zero PII/Aadhaar exposure).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={uploadTargetBucket}
                  onChange={(e) => setUploadTargetBucket(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200"
                >
                  {infra.storage.buckets.map((b) => (
                    <option key={b.logicalName} value={b.logicalName}>
                      {b.logicalName} ({b.accessClassification})
                    </option>
                  ))}
                </select>

                <label className="px-3.5 py-2 bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload to R2'}</span>
                  <input type="file" className="hidden" onChange={handleUploadFile} disabled={uploading} />
                </label>

                <select
                  value={selectedBucketFilter}
                  onChange={(e) => setSelectedBucketFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200"
                >
                  <option value="all">Filter: All Buckets</option>
                  {infra.storage.buckets.map((b) => (
                    <option key={b.logicalName} value={b.logicalName}>
                      {b.logicalName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {files.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No files recorded in D1 file_registry for this filter yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs tabular-nums">
                {files.map((f) => (
                  <div key={f.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {f.originalFilename}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        {f.logicalBucket} · {f.accessClassification} · {formatBytes(f.fileSize)} · {f.mimeType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSignedDownload(f.id)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3 h-3" />
                        <span>Signed Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(f.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                        title="Delete file from R2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backups Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#138808]" />
              <span>Verified Free-Plan D1 → R2 Backups ({infra.backups.length})</span>
            </h3>

            {infra.backups.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No R2 database snapshots recorded yet. Click "Create D1 Backup → R2" to generate a SHA-256 verified export.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs tabular-nums">
                {infra.backups.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {b.id} · {b.verificationStatus}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {b.tablesCount} tables · {b.rowsCount} rows · {formatBytes(b.byteSize)} · SHA256:{b.checksum.slice(0, 12)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleVerifyBackup(b.id)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Re-Verify Checksum
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await downloadD1BackupFile(b.id);
                          if (!res.ok && res.message) setErrorMessage(res.message);
                        }}
                        className="px-2.5 py-1.5 bg-[#138808] text-white rounded-lg font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Download JSON
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
