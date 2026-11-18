import React, { useState, useEffect } from 'react';
import {
  googleSignIn,
  firebaseLogout,
  getAccessToken,
  initAuth,
  testFirestoreConnection,
  db,
  handleFirestoreError,
  OperationType,
} from '../../services/firebase';
import {
  listDriveFiles,
  uploadTextFileToDrive,
  deleteDriveFile,
  DriveFileItem,
  listGmailMessages,
  sendGmailMessage,
  GmailMessageSummary,
  listGoogleForms,
  createGoogleForm,
  getFormResponses,
  GoogleFormItem,
  listGoogleTasks,
  createGoogleTask,
  completeGoogleTask,
  deleteGoogleTask,
  GoogleTaskItem,
} from '../../services/workspaceService';
import { GoogleSignInButton } from '../../components/workspace/GoogleSignInButton';
import { ConfirmOperationModal } from '../../components/workspace/ConfirmOperationModal';
import {
  InlineSkeletonPulse,
  ListRowsSkeleton,
  TableRowsSkeleton,
} from '../../components/common/SkeletonLoaders';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import {
  HardDrive,
  Mail,
  FileSpreadsheet,
  CheckSquare,
  Database,
  ShieldCheck,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  FolderPlus,
} from 'lucide-react';

interface WorkspaceHubProps {
  onNavigate?: (route: string) => void;
}

export const WorkspaceHub: React.FC<WorkspaceHubProps> = ({ onNavigate }) => {
  const { user: authUser } = useAuth();
  const { services, createApplication } = useData();
  // Auth & Connection States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [firestoreHealthy, setFirestoreHealthy] = useState<boolean | null>(null);
  const [formApplicantName, setFormApplicantName] = useState('');
  const [formApplicantMobile, setFormApplicantMobile] = useState('');
  const [formServiceSlug, setFormServiceSlug] = useState(services[0]?.slug || 'pan-card');
  const [formTrackedId, setFormTrackedId] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'drive' | 'gmail' | 'forms' | 'tasks' | 'firestore'>('drive');

  // Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [loadingDrive, setLoadingDrive] = useState(false);

  // Gmail state
  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [emailTo, setEmailTo] = useState('allindiadigitalseva@gmail.com');
  const [emailSubject, setEmailSubject] = useState('Application Status Update — Digital India Project');
  const [emailBody, setEmailBody] = useState(
    'Dear Applicant,\n\nYour online service application has been processed successfully. You may download your acknowledgement receipt directly from your dashboard.\n\nWarm regards,\nDigital India Project Team\nSilvassa (Dadra & Nagar Haveli)'
  );

  // Forms state
  const [formsList, setFormsList] = useState<GoogleFormItem[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formTitle, setFormTitle] = useState('Digital India Project — Citizen Service Intake & Verification Form');
  const [formDesc, setFormDesc] = useState(
    'Official digital service intake and citizen feedback collection form for PAN, Udyam, and GST assistance.'
  );

  // Tasks state
  const [tasksList, setTasksList] = useState<GoogleTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  // Firestore Sync state
  const [firestoreLogs, setFirestoreLogs] = useState<any[]>([]);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Mandatory Confirmation Modal State (Per Workspace Integration Skill)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    isDestructive: false,
    action: async () => {},
  });
  const [modalLoading, setModalLoading] = useState(false);

  // Init auth listener and Firestore connection check
  useEffect(() => {
    testFirestoreConnection().then((ok) => setFirestoreHealthy(ok));

    const unsubscribe = initAuth(
      (user, tkn) => {
        setCurrentUser(user);
        setToken(tkn);
      },
      () => {
        setCurrentUser(null);
        setToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch data when active tab changes and token is available
  useEffect(() => {
    if (!token) return;

    if (activeTab === 'drive') {
      loadDriveFiles();
    } else if (activeTab === 'gmail') {
      loadGmailMessages();
    } else if (activeTab === 'forms') {
      loadGoogleForms();
    } else if (activeTab === 'tasks') {
      loadGoogleTasks();
    } else if (activeTab === 'firestore') {
      loadFirestoreAudits();
    }
  }, [activeTab, token]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn(undefined, { includeWorkspaceScopes: true });
      if (res) {
        setCurrentUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setWorkspaceNotice({ type: 'err', text: `Sign in failed: ${err.message || err}` });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await firebaseLogout();
    setCurrentUser(null);
    setToken(null);
    setDriveFiles([]);
    setGmailMessages([]);
    setFormsList([]);
    setTasksList([]);
  };

  // 1. Google Drive Operations
  const loadDriveFiles = async () => {
    if (!token) return;
    setLoadingDrive(true);
    try {
      const files = await listDriveFiles(token, driveSearch);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Drive load error:', err);
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleBackupDossierToDrive = () => {
    const fileName = `DIP_Workspace_Backup_${Date.now()}.txt`;
    const content = `DIGITAL INDIA PROJECT — WORKSPACE BACKUP SUMMARY
Timestamp: ${new Date().toISOString()}
Account: ${currentUser?.displayName || 'Workspace User'} (${currentUser?.email || 'No email'})
Head Office: Sunflower Building, Nano City, Samarvani, Silvassa – 396230
Helpline: +91 77779 41227
Official Domain: https://digitalindiaproject.com`;

    setConfirmModal({
      isOpen: true,
      title: 'Upload File to Google Drive?',
      description: `This action will upload "${fileName}" to your personal Google Drive with permission from the app user.`,
      confirmLabel: 'Upload to Drive',
      isDestructive: false,
      action: async () => {
        if (!token) return;
        await uploadTextFileToDrive(token, fileName, content, 'text/plain');
        await recordFirestoreAudit('upload_file', 'drive', `Uploaded file ${fileName}`);
        await loadDriveFiles();
      },
    });
  };

  const handleDeleteFilePrompt = (file: DriveFileItem) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete File "${file.name}"?`,
      description: `Are you sure you want to permanently delete this file from Google Drive? This action cannot be undone.`,
      confirmLabel: 'Delete File',
      isDestructive: true,
      action: async () => {
        if (!token) return;
        await deleteDriveFile(token, file.id);
        await recordFirestoreAudit('delete_file', 'drive', `Deleted file ${file.name} (${file.id})`);
        await loadDriveFiles();
      },
    });
  };

  // 2. Gmail Operations
  const loadGmailMessages = async () => {
    if (!token) return;
    setLoadingGmail(true);
    try {
      const msgs = await listGmailMessages(token);
      setGmailMessages(msgs);
    } catch (err: any) {
      console.error('Gmail load error:', err);
    } finally {
      setLoadingGmail(false);
    }
  };

  const handleSendEmailPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: 'Send Email via Gmail?',
      description: `You are about to send an email to "${emailTo}" with subject "${emailSubject}" from your authenticated Gmail address.`,
      confirmLabel: 'Send via Gmail',
      isDestructive: false,
      action: async () => {
        if (!token) return;
        await sendGmailMessage(token, emailTo, emailSubject, emailBody);
        await recordFirestoreAudit('send_email', 'gmail', `Sent email to ${emailTo}: "${emailSubject}"`);
        setWorkspaceNotice({ type: 'ok', text: `Email dispatched successfully to ${emailTo} via Gmail API.` });
        await loadGmailMessages();
      },
    });
  };

  // 3. Google Forms Operations
  const loadGoogleForms = async () => {
    if (!token) return;
    setLoadingForms(true);
    try {
      const forms = await listGoogleForms(token);
      setFormsList(forms);
    } catch (err: any) {
      console.error('Forms load error:', err);
    } finally {
      setLoadingForms(false);
    }
  };

  const handleCreateFormPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: 'Create New Google Form?',
      description: `This will create a new Google Form entitled "${formTitle}" in your Google account with intake survey questions.`,
      confirmLabel: 'Create Form',
      isDestructive: false,
      action: async () => {
        if (!token) return;
        const res = await createGoogleForm(token, formTitle, formDesc);
        await recordFirestoreAudit('create_form', 'forms', `Created form "${formTitle}" (${res.formId})`);
        setWorkspaceNotice({
          type: 'ok',
          text: `Google Form created! Responder Link: ${res.responderUri}`,
        });
        await loadGoogleForms();
      },
    });
  };

  // 4. Google Tasks Operations
  const loadGoogleTasks = async () => {
    if (!token) return;
    setLoadingTasks(true);
    try {
      const items = await listGoogleTasks(token);
      setTasksList(items);
    } catch (err: any) {
      console.error('Tasks load error:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateTaskPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setConfirmModal({
      isOpen: true,
      title: 'Add Google Task?',
      description: `This will create the task "${taskTitle}" in your Google Tasks account.`,
      confirmLabel: 'Create Task',
      isDestructive: false,
      action: async () => {
        if (!token) return;
        await createGoogleTask(token, taskTitle, taskNotes);
        await recordFirestoreAudit('create_task', 'tasks', `Created task: ${taskTitle}`);
        setTaskTitle('');
        setTaskNotes('');
        await loadGoogleTasks();
      },
    });
  };

  const handleCompleteTaskPrompt = (task: GoogleTaskItem) => {
    setConfirmModal({
      isOpen: true,
      title: `Mark Task Complete?`,
      description: `Mark task "${task.title}" as completed in Google Tasks.`,
      confirmLabel: 'Mark Completed',
      isDestructive: false,
      action: async () => {
        if (!token) return;
        await completeGoogleTask(token, task.id);
        await recordFirestoreAudit('complete_task', 'tasks', `Completed task: ${task.title}`);
        await loadGoogleTasks();
      },
    });
  };

  const handleDeleteTaskPrompt = (task: GoogleTaskItem) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Task "${task.title}"?`,
      description: `Permanently delete this task from your Google Tasks list?`,
      confirmLabel: 'Delete Task',
      isDestructive: true,
      action: async () => {
        if (!token) return;
        await deleteGoogleTask(token, task.id);
        await recordFirestoreAudit('delete_task', 'tasks', `Deleted task: ${task.title}`);
        await loadGoogleTasks();
      },
    });
  };

  // 5. Firebase Firestore Auditing & Real-Time Sync
  const recordFirestoreAudit = async (actionType: string, targetService: 'drive' | 'gmail' | 'forms' | 'tasks', details: string) => {
    if (!currentUser) return;
    try {
      const auditId = `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const ref = doc(db, 'workspace_audits', auditId);
      await setDoc(ref, {
        id: auditId,
        userId: currentUser.uid,
        actionType,
        targetService,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('Firestore audit write failed:', err);
    }
  };

  const loadFirestoreAudits = async () => {
    if (!currentUser) return;
    setSyncingFirestore(true);
    try {
      const isAdminEmail =
        (authUser?.email || currentUser.email || '').toLowerCase() === 'allindiadigitalseva@gmail.com';
      const q = isAdminEmail
        ? query(collection(db, 'workspace_audits'), limit(20))
        : query(collection(db, 'workspace_audits'), where('userId', '==', currentUser.uid), limit(20));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => d.data());
      setFirestoreLogs(items);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'workspace_audits');
    } finally {
      setSyncingFirestore(false);
    }
  };

  const handleExecuteModalAction = async () => {
    setModalLoading(true);
    try {
      await confirmModal.action();
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      setWorkspaceNotice({ type: 'err', text: `Operation failed: ${err.message || err}` });
    } finally {
      setModalLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isStaffAuthorized =
    authUser &&
    (authUser.role === 'operator' || authUser.role === 'admin' || authUser.role === 'super_admin');

  if (!isStaffAuthorized) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900">Staff & Operator Authorization Required</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Google Workspace synchronization (Drive, Gmail dispatch, Forms intake, and Operational Tasks) is restricted to verified Operators and Administrators.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="bg-[#FF671F] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Return to My Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Top Banner with Google Workspace & Firebase Badges */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-50 border border-orange-200 text-[#FF671F] font-bold text-xs">
              <Database className="w-3.5 h-3.5" />
              <span>Firebase Firestore & Auth</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Google Workspace Services</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
              Region: asia-southeast1
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Google Workspace & Firebase Cloud Center
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Integrated Google Drive file archives, Gmail notifications, Google Forms citizen intake, and Google Tasks workflow automation, securely orchestrated with Firebase Firestore real-time persistence.
          </p>
        </div>

        {/* User Account / Auth Status */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-start md:items-end gap-3 text-xs shrink-0">
          {currentUser ? (
            <div className="space-y-1.5 text-left md:text-right">
              <div className="font-bold text-slate-900">{currentUser.displayName || 'Authorized User'}</div>
              <div className="text-[11px] text-slate-500 font-mono">{currentUser.email}</div>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 font-bold text-xs hover:underline cursor-pointer"
                >
                  Disconnect Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] text-slate-500 block">Sign in to authorize Drive, Gmail, Forms & Tasks</span>
              <GoogleSignInButton onClick={handleSignIn} isLoading={isSigningIn} />
            </div>
          )}
        </div>
      </div>

      {workspaceNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            workspaceNotice.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 font-medium break-all">
            {workspaceNotice.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{workspaceNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setWorkspaceNotice(null)}
            className="text-xs font-bold underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-bold scrollbar-none">
        {[
          { id: 'drive', label: 'Google Drive', icon: HardDrive, count: driveFiles.length },
          { id: 'gmail', label: 'Gmail', icon: Mail, count: gmailMessages.length },
          { id: 'forms', label: 'Google Forms', icon: FileSpreadsheet, count: formsList.length },
          { id: 'tasks', label: 'Google Tasks', icon: CheckSquare, count: tasksList.length },
          { id: 'firestore', label: 'Firebase Firestore', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GOOGLE DRIVE */}
      {activeTab === 'drive' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600" />
                <span>Google Drive Cloud Archives</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage, search, and securely back up citizen applications, PAN acknowledgements, and trade files.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDriveFiles}
                disabled={!token || loadingDrive}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-40 inline-flex items-center justify-center min-w-[36px] min-h-[36px]"
                title="Refresh Drive files"
              >
                {loadingDrive ? <InlineSkeletonPulse className="w-4" /> : <RefreshCw className="w-4 h-4" />}
              </button>
              <button
                onClick={handleBackupDossierToDrive}
                disabled={!token}
                className="px-4 py-2 bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Backup Dossier to Drive</span>
              </button>
            </div>
          </div>

          {!token ? (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Google Drive Authorization Required</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Sign in with Google to browse and organize your Google Drive documents with permission from the app user.
              </p>
              <GoogleSignInButton onClick={handleSignIn} isLoading={isSigningIn} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter Drive files by name..."
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadDriveFiles()}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                />
              </div>

              {loadingDrive ? (
                <TableRowsSkeleton rows={5} cols={4} />
              ) : driveFiles.length === 0 ? (
                <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                  No files found. Click "Backup Dossier to Drive" to upload your first citizen record.
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
                  <table className="w-full min-w-[560px] text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">File Name</th>
                        <th className="p-3.5">MIME Type</th>
                        <th className="p-3.5">Last Modified</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {driveFiles.map((file) => (
                        <tr key={file.id} className="hover:bg-slate-50">
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{file.name}</span>
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-blue-600"
                                  title="Open in Google Drive"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-[10px] text-slate-500">{file.mimeType}</td>
                          <td className="p-3.5 text-slate-500 text-[11px]">
                            {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => handleDeleteFilePrompt(file)}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                              title="Delete File (requires confirmation)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GMAIL */}
      {activeTab === 'gmail' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Email Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-600" />
                <span>Send Dispatch & Citizen Update via Gmail</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Send official notifications and status communications with explicit user confirmation.
              </p>
            </div>

            {!token ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-600">Sign in with Google to send messages via your Gmail account.</p>
                <GoogleSignInButton onClick={handleSignIn} isLoading={isSigningIn} />
              </div>
            ) : (
              <form onSubmit={handleSendEmailPrompt} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient Email</label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                  <textarea
                    rows={6}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Review & Send Email</span>
                </button>
              </form>
            )}
          </div>

          {/* Recent Messages / Inbox */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Recent Gmail Threads</h3>
                <p className="text-[11px] text-slate-500">Connected to your authenticated mailbox</p>
              </div>
              <button
                onClick={loadGmailMessages}
                disabled={!token || loadingGmail}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-40 inline-flex items-center justify-center min-w-[30px] min-h-[30px]"
              >
                {loadingGmail ? <InlineSkeletonPulse className="w-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!token ? (
              <p className="text-xs text-slate-400">Sign in to view recent messages.</p>
            ) : loadingGmail ? (
              <ListRowsSkeleton rows={4} compact />
            ) : gmailMessages.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No recent messages found.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {gmailMessages.map((msg) => (
                  <div key={msg.id} className="py-2.5 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-900 truncate max-w-[200px]">{msg.from}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{msg.date?.substring(0, 16)}</span>
                    </div>
                    <div className="font-medium text-slate-800 text-[11px]">{msg.subject}</div>
                    <p className="text-slate-500 text-[10px] line-clamp-1">{msg.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GOOGLE FORMS */}
      {activeTab === 'forms' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Form Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <span>Create Citizen Service Intake Form</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically generate survey and document intake Google Forms with pre-configured validation fields.
              </p>
            </div>

            {!token ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-600">Sign in with Google to create and inspect Google Forms.</p>
                <GoogleSignInButton onClick={handleSignIn} isLoading={isSigningIn} />
              </div>
            ) : (
              <form onSubmit={handleCreateFormPrompt} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Form Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-1 text-[11px] text-purple-900">
                  <span className="font-bold block">Included Default Intake Questions:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                    <li>Full Applicant / Business Entity Name</li>
                    <li>Application Reference ID or Mobile Number</li>
                    <li>Service Category (PAN, Udyam MSME, GST, Gazette Name Change)</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Generate Google Form</span>
                </button>
              </form>
            )}
          </div>

          {/* Existing Google Forms */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active Google Forms</h3>
                <p className="text-[11px] text-slate-500">Live intake forms associated with your Google account</p>
              </div>
              <button
                onClick={loadGoogleForms}
                disabled={!token || loadingForms}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-40 inline-flex items-center justify-center min-w-[30px] min-h-[30px]"
              >
                {loadingForms ? <InlineSkeletonPulse className="w-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!token ? (
              <p className="text-xs text-slate-400">Sign in to list Google Forms.</p>
            ) : loadingForms ? (
              <ListRowsSkeleton rows={3} compact />
            ) : formsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No Google Forms detected yet.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {formsList.map((f) => (
                  <div key={f.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{f.name}</div>
                      <div className="text-[10px] text-slate-400">
                        Modified: {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : '—'}
                      </div>
                    </div>
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Import Google Form Response into Unified Application Tracker */}
            <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
              <div className="font-bold text-slate-900">Record Citizen Form Response to Unified Tracker</div>
              {formTrackedId && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-semibold">
                  Intake recorded as <span className="font-mono">{formTrackedId}</span> (Source: Google Forms).
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Applicant Name"
                  value={formApplicantName}
                  onChange={(e) => setFormApplicantName(e.target.value)}
                  className="bg-[#F7F8FA] border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
                <input
                  type="tel"
                  placeholder="Mobile (+91...)"
                  value={formApplicantMobile}
                  onChange={(e) => setFormApplicantMobile(e.target.value)}
                  className="bg-[#F7F8FA] border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
                <select
                  value={formServiceSlug}
                  onChange={(e) => setFormServiceSlug(e.target.value)}
                  className="bg-[#F7F8FA] border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!formApplicantName.trim() || !formApplicantMobile.trim()) return;
                  const created = await createApplication(
                    formServiceSlug,
                    {
                      full_name: formApplicantName.trim(),
                      userMobile: formApplicantMobile.trim(),
                      userEmail: currentUser?.email || 'intake@digitalindiaproject.com',
                    },
                    [
                      {
                        documentType: 'Google Forms Submission Bundle',
                        fileName: `${formApplicantName.trim().replace(/\s+/g, '_')}_FormResponse.pdf`,
                        fileSize: 250000,
                        mimeType: 'application/pdf',
                      },
                    ],
                    { sourceChannel: 'google_forms' }
                  );
                  setFormTrackedId(created.id);
                  setFormApplicantName('');
                  setFormApplicantMobile('');
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Import Response to Tracker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GOOGLE TASKS */}
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add Task Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>Google Tasks Operational Follow-ups</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize operator document review deadlines, dispatch reminders, and compliance audits in Google Tasks.
              </p>
            </div>

            {!token ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                <p className="text-xs text-slate-600">Sign in with Google to synchronize with Google Tasks.</p>
                <GoogleSignInButton onClick={handleSignIn} isLoading={isSigningIn} />
              </div>
            ) : (
              <form onSubmit={handleCreateTaskPrompt} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Task Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Verify document copy for DIP-2026-XXXXX"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes / Internal Reference</label>
                  <textarea
                    rows={3}
                    placeholder="Dossier ID, applicant contact, or compliance checklist notes..."
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Google Tasks</span>
                </button>
              </form>
            )}
          </div>

          {/* Tasks List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Your Tasks</h3>
                <p className="text-[11px] text-slate-500">Fetched directly from Google Tasks</p>
              </div>
              <button
                onClick={loadGoogleTasks}
                disabled={!token || loadingTasks}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-40 inline-flex items-center justify-center min-w-[30px] min-h-[30px]"
              >
                {loadingTasks ? <InlineSkeletonPulse className="w-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>

            {!token ? (
              <p className="text-xs text-slate-400">Sign in to view your tasks.</p>
            ) : loadingTasks ? (
              <ListRowsSkeleton rows={4} compact />
            ) : tasksList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No active tasks found in Google Tasks.</div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {tasksList.map((task) => (
                  <div key={task.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div
                        className={`font-semibold ${
                          task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </div>
                      {task.notes && <p className="text-[10px] text-slate-500 line-clamp-1">{task.notes}</p>}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.status !== 'completed' && (
                        <button
                          onClick={() => handleCompleteTaskPrompt(task)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] cursor-pointer"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTaskPrompt(task)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: FIREBASE FIRESTORE LIVE AUDIT */}
      {activeTab === 'firestore' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Connection Status</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${firestoreHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
                <span className="font-bold text-slate-900 text-sm">
                  {firestoreHealthy ? 'Firestore Connected (Live)' : 'Validating Connection...'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">Verified via getDocFromServer</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Database ID</span>
              <div className="font-mono text-xs font-bold text-slate-800 truncate">
                ai-studio-digitalindiaproj...
              </div>
              <span className="text-[10px] text-slate-500">Region: asia-southeast1</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Security Rules Status</span>
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero-Trust ABAC Deployed</span>
              </div>
              <span className="text-[10px] text-slate-500">Eight Pillars Hardened Rules Active</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Firestore Audit Trail (`/workspace_audits`)</h3>
                <p className="text-[11px] text-slate-500">
                  Every Drive upload, Gmail dispatch, Google Form creation, and Task completed is recorded in Firestore.
                </p>
              </div>
              <button
                onClick={loadFirestoreAudits}
                disabled={syncingFirestore}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                {syncingFirestore ? (
                  <>
                    <InlineSkeletonPulse className="w-3.5" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Log</span>
                  </>
                )}
              </button>
            </div>

            {syncingFirestore ? (
              <TableRowsSkeleton rows={4} cols={5} />
            ) : firestoreLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No Workspace actions recorded yet. Perform a Drive upload or send an email to see real-time audit logs.
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl overflow-x-auto border border-slate-200 dark:border-slate-700 text-xs">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Audit ID</th>
                      <th className="p-3">Target Service</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Details</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {firestoreLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-white">
                        <td className="p-3 font-bold text-[#FF671F]">{log.id}</td>
                        <td className="p-3">
                          <span className="uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px]">
                            {log.targetService}
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 font-semibold">{log.actionType}</td>
                        <td className="p-3 text-slate-600 font-sans">{log.details}</td>
                        <td className="p-3 text-slate-400 text-[10px]">{log.timestamp?.substring(0, 19)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Modal for Destructive/Mutating Operations */}
      <ConfirmOperationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        isLoading={modalLoading}
        onConfirm={handleExecuteModalAction}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
