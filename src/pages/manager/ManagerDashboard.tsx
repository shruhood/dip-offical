import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Application, ApplicationStatus } from '../../types';
import { computeSlaHoursRemaining } from '../../lib/workflow';
import { isSuperAdminRole, normalizeRole } from '../../lib/rbac';
import { SwipeableActionItem } from '../../components/common/SwipeableActionItem';
import {
  Shield,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  MessageSquare,
  TrendingUp,
  UserPlus,
  Lock,
  ArrowRight,
  Search,
  BarChart3,
} from 'lucide-react';

interface ManagerDashboardProps {
  initialTab?: string;
  onNavigate: (route: string, param?: string) => void;
}

type ManagerTabId = 'sla' | 'assign' | 'tickets' | 'partners' | 'reports';

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  initialTab = 'sla',
  onNavigate,
}) => {
  const { user, can } = useAuth();
  const {
    applications,
    operatorEnrollments,
    partners,
    tickets,
    assignOperator,
    bulkAssignOperator,
    updateApplicationStatus,
    replyTicket,
  } = useData();

  const resolveManagerTab = (t?: string): ManagerTabId =>
    (['sla', 'assign', 'tickets', 'partners', 'reports'].includes(t || '') ? (t as ManagerTabId) : 'sla');

  const [activeTab, setActiveTab] = useState<ManagerTabId>(() => resolveManagerTab(initialTab));

  useEffect(() => {
    setActiveTab(resolveManagerTab(initialTab));
  }, [initialTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const approvedOperators = useMemo(() => {
    return operatorEnrollments
      .filter((e) => e.kycStatus === 'Approved')
      .map((e) => ({ id: e.userId, name: `${e.fullName} (${e.operatingDistrict})` }));
  }, [operatorEnrollments]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetOperatorId, setTargetOperatorId] = useState('');
  const [targetOperatorName, setTargetOperatorName] = useState('');
  const [actionBanner, setActionBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [ticketReply, setTicketReply] = useState<Record<string, string>>({});

  const normalizedRole = normalizeRole(user?.role);
  const isAuthorized = user && (normalizedRole === 'manager' || isSuperAdminRole(normalizedRole));

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-4">
          <Lock className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Operations Manager Access Required
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            This workspace is restricted to authorized Digital India Project Operations Managers and Super Administrators.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="bg-[#FF671F] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Return to My Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const enrichedApps = useMemo(() => {
    return applications.map((app) => {
      const sla = computeSlaHoursRemaining(app.slaTargetAt ? app.slaTargetAt : app.submissionDate, app.slaTargetAt ? 0 : 72);
      return { app, sla };
    });
  }, [applications]);

  const overdueApps = enrichedApps.filter(
    ({ app, sla }) =>
      sla.isOverdue && !['Completed', 'Rejected', 'Cancelled', 'Refunded'].includes(app.status)
  );
  const unassignedApps = applications.filter((a) => !a.assignedOperatorId && a.status !== 'Completed');

  const filteredApps = enrichedApps.filter(({ app }) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      app.id.toLowerCase().includes(q) ||
      app.userName.toLowerCase().includes(q) ||
      app.serviceName.toLowerCase().includes(q)
    );
  });

  const operatorWorkload = useMemo(() => {
    const map = new Map<string, { name: string; active: number; completed: number }>();
    applications.forEach((a) => {
      if (!a.assignedOperatorName) return;
      const prev = map.get(a.assignedOperatorName) || { name: a.assignedOperatorName, active: 0, completed: 0 };
      if (a.status === 'Completed') prev.completed += 1;
      else prev.active += 1;
      map.set(a.assignedOperatorName, prev);
    });
    return Array.from(map.values());
  }, [applications]);

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !targetOperatorId || !targetOperatorName) {
      setActionBanner({ type: 'err', text: 'Select at least one application and a KYC-approved operator.' });
      setTimeout(() => setActionBanner(null), 4000);
      return;
    }
    if (!can('applications.assign')) {
      setActionBanner({ type: 'err', text: 'Your manager profile does not have permission to assign applications.' });
      return;
    }
    await bulkAssignOperator(selectedIds, targetOperatorId, targetOperatorName);
    setActionBanner({
      type: 'ok',
      text: `Assigned ${selectedIds.length} application(s) to ${targetOperatorName}.`,
    });
    setSelectedIds([]);
    setTimeout(() => setActionBanner(null), 4000);
  };

  const handleEscalateCorrection = async (app: Application) => {
    const res = await updateApplicationStatus(
      app.id,
      'Correction Required',
      'Manager escalation: Kindly verify and resubmit corrected applicant details.',
      `Escalated by Manager ${user.name}`,
      user.name,
      normalizedRole
    );
    if (!res.ok && res.error) {
      setActionBanner({ type: 'err', text: res.error });
    } else {
      setActionBanner({ type: 'ok', text: `Application ${app.id} flagged for Correction Required.` });
    }
    setTimeout(() => setActionBanner(null), 4000);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-[#1E293B] text-white p-6 sm:p-8 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFC928] uppercase tracking-wider">
            <Shield className="w-4 h-4 text-[#FF671F]" />
            <span>Operations Manager Command · Scope: {user.managerScope || 'All Regional Desks'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-1">
            Queue Routing, SLA Oversight & Team Allocation
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Signed in as <strong>{user.name}</strong> · Balance operator workloads, track SLAs, and resolve escalations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onNavigate('operator')}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3.5 py-2 rounded-xl border border-slate-700 cursor-pointer"
          >
            Open Verification Desk
          </button>
          {isSuperAdminRole(normalizedRole) && (
            <button
              onClick={() => onNavigate('admin')}
              className="text-xs font-bold bg-[#FF671F] hover:bg-[#E55B1B] text-white px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1"
            >
              <span>Super Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Active Pipeline</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{applications.length}</div>
          <span className="text-[11px] text-slate-500">All intake channels</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Unassigned Queue</span>
          <div className="text-2xl font-black text-[#FF671F] mt-1">{unassignedApps.length}</div>
          <span className="text-[11px] text-slate-500">Ready for operator routing</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">SLA Breaches</span>
          <div className="text-2xl font-black text-red-600 mt-1">{overdueApps.length}</div>
          <span className="text-[11px] text-red-500">Require immediate escalation</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Open Tickets</span>
          <div className="text-2xl font-black text-[#138808] mt-1">
            {tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length}
          </div>
          <span className="text-[11px] text-slate-500">Customer & Partner support</span>
        </div>
      </div>

      {actionBanner && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
            actionBanner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
          }`}
        >
          {actionBanner.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionBanner.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {[
          { id: 'sla', label: `SLA & Escalations (${overdueApps.length})`, icon: Clock },
          { id: 'assign', label: 'Operator Assignment Queue', icon: Users },
          { id: 'tickets', label: `Tickets (${tickets.length})`, icon: MessageSquare },
          { id: 'partners', label: `Partner Oversight (${partners.length})`, icon: UserPlus },
          { id: 'reports', label: 'Workload Metrics', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#FF671F] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: SLA & ESCALATIONS */}
      {activeTab === 'sla' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                SLA Countdown & Bottleneck Queue
              </h2>
              <p className="text-xs text-slate-500">
                Monitor deadline proximity across every active dossier and trigger fast corrections.
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, applicant, service..."
                className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
              />
            </div>
          </div>

          {/* Mobile / Tablet Swipeable SLA Queue */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] text-slate-500 dark:text-slate-400">
              Swipe right to Assign Officer · Swipe left to Flag Correction
            </div>
            {filteredApps.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No active dossiers in pipeline yet.
              </div>
            ) : (
              filteredApps.map(({ app, sla }) => {
                const canEscalate = !['Completed', 'Cancelled', 'Rejected'].includes(app.status);
                return (
                  <SwipeableActionItem
                    key={app.id}
                    className="rounded-none"
                    contentClassName="bg-white dark:bg-slate-900"
                    leftAction={{
                      label: 'Assign Officer',
                      shortLabel: 'Assign',
                      icon: <UserPlus className="w-4 h-4" />,
                      tone: 'success',
                      onAction: () => {
                        setSelectedIds([app.id]);
                        setActiveTab('assign');
                      },
                    }}
                    rightAction={
                      canEscalate
                        ? {
                            label: 'Request Correction',
                            shortLabel: 'Correction',
                            icon: <AlertTriangle className="w-4 h-4" />,
                            tone: 'warning',
                            onAction: () => void handleEscalateCorrection(app),
                          }
                        : undefined
                    }
                  >
                    <div className="p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#FF671F]">{app.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            app.status === 'Completed'
                              ? 'bg-emerald-50 text-[#138808]'
                              : sla.isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {app.status === 'Completed' ? 'Closed' : sla.label}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{app.serviceName}</div>
                        <div className="text-[11px] text-slate-500">
                          {app.userName} · {app.userMobile}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {app.status}
                        </span>
                        <span className="text-slate-500">
                          Officer: <strong className="text-slate-700 dark:text-slate-300">{app.assignedOperatorName || 'Unassigned'}</strong>
                        </span>
                      </div>
                    </div>
                  </SwipeableActionItem>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Application ID</th>
                  <th className="p-3.5">Service & Applicant</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Assigned Officer</th>
                  <th className="p-3.5">SLA Timer</th>
                  <th className="p-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No active dossiers in pipeline yet.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map(({ app, sla }) => (
                    <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono font-bold text-[#FF671F]">{app.id}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{app.serviceName}</div>
                        <div className="text-[11px] text-slate-500">
                          {app.userName} · {app.userMobile}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {app.assignedOperatorName || (
                          <span className="text-amber-600 font-semibold">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            app.status === 'Completed'
                              ? 'bg-emerald-50 text-[#138808]'
                              : sla.isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {app.status === 'Completed' ? 'Closed' : sla.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {!['Completed', 'Cancelled', 'Rejected'].includes(app.status) && (
                          <button
                            type="button"
                            onClick={() => handleEscalateCorrection(app)}
                            className="text-[11px] font-bold text-[#FF671F] hover:underline cursor-pointer"
                          >
                            Request Correction
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: BULK OPERATOR ASSIGNMENT */}
      {activeTab === 'assign' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <FileCheck2 className="w-4 h-4 text-[#FF671F]" />
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Selected: {selectedIds.length} application(s)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={targetOperatorId}
                onChange={(e) => {
                  const found = approvedOperators.find((o) => o.id === e.target.value);
                  setTargetOperatorId(e.target.value);
                  setTargetOperatorName(found ? found.name : '');
                }}
                className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
              >
                <option value="">
                  {approvedOperators.length === 0
                    ? 'No KYC-approved operators available yet'
                    : 'Select approved operator...'}
                </option>
                {approvedOperators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={selectedIds.length === 0 || !targetOperatorId || !targetOperatorName}
                onClick={handleBulkAssign}
                className="bg-[#138808] hover:bg-emerald-700 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Assign Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          {applications.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              No applications waiting in the queue yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {applications.map((app) => {
                const isSelected = selectedIds.includes(app.id);
                const canEscalate = !['Completed', 'Cancelled', 'Rejected'].includes(app.status);
                return (
                  <SwipeableActionItem
                    key={app.id}
                    onClick={() => toggleSelect(app.id)}
                    className={`rounded-2xl border transition ${
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
                      label: isSelected ? 'Deselect Application' : 'Select Application',
                      shortLabel: isSelected ? 'Unselect' : 'Select',
                      icon: <CheckCircle2 className="w-4 h-4" />,
                      tone: 'primary',
                      onAction: () => toggleSelect(app.id),
                    }}
                    rightAction={
                      canEscalate
                        ? {
                            label: 'Request Correction',
                            shortLabel: 'Correction',
                            icon: <AlertTriangle className="w-4 h-4" />,
                            tone: 'warning',
                            onAction: () => void handleEscalateCorrection(app),
                          }
                        : undefined
                    }
                  >
                    <div className="p-4 cursor-pointer flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-[#FF671F]"
                          />
                          <span className="font-mono font-bold text-[#FF671F]">{app.id}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{app.serviceName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-5">
                          Applicant: {app.userName} · Current Officer:{' '}
                          <strong>{app.assignedOperatorName || 'Unassigned'}</strong>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {app.status}
                      </span>
                    </div>
                  </SwipeableActionItem>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              No customer or partner support tickets raised yet.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-[#FF671F] mr-2">{t.ticketNumber}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{t.subject}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                    {t.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Raised by {t.userName} ({t.userEmail}) · {t.messages.length} message(s)
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ticketReply[t.id] || ''}
                    onChange={(e) => setTicketReply((p) => ({ ...p, [t.id]: e.target.value }))}
                    placeholder="Write manager response..."
                    className="flex-1 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const txt = (ticketReply[t.id] || '').trim();
                      if (!txt) return;
                      replyTicket(t.id, user.id, user.name, normalizedRole, txt);
                      setTicketReply((p) => ({ ...p, [t.id]: '' }));
                    }}
                    className="bg-[#FF671F] text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: PARTNER OVERSIGHT */}
      {activeTab === 'partners' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Regional Partner Activity Summary
          </h2>
          {partners.length === 0 ? (
            <p className="text-slate-500">No partner enrollments recorded yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{p.businessName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                      {p.approvalStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Code: <strong className="font-mono">{p.partnerCode}</strong> · Referral:{' '}
                    <strong className="font-mono">{p.referralCode}</strong>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Location: {p.district}, {p.state}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: WORKLOAD REPORTS */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <TrendingUp className="w-4 h-4 text-[#FF671F]" />
              <span>Active Workload per Operator</span>
            </div>
            {operatorWorkload.length === 0 ? (
              <p className="text-slate-500">Assign operators to populate desk workload distribution.</p>
            ) : (
              <div className="space-y-2 tabular-nums">
                {operatorWorkload.map((op) => (
                  <div
                    key={op.name}
                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{op.name}</span>
                    <span className="font-mono">
                      Active: <strong>{op.active}</strong> · Completed: <strong>{op.completed}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
