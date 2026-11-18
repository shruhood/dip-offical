import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CalendarClock,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  IndianRupee,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  ComplianceReminderRecord,
  createComplianceReminder,
  deleteComplianceReminder,
  fetchComplianceReminders,
  updateComplianceReminder,
} from '../../services/backendApi';
import {
  InlineSkeletonPulse,
  ListRowsSkeleton,
} from '../common/SkeletonLoaders';

export interface GstCalculationResult {
  baseAmount: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

export function calculateGstBreakdown(params: {
  amountInr: number;
  gstRatePct: number;
  inclusive: boolean;
  interState: boolean;
}): GstCalculationResult {
  const safeAmount = Math.max(0, Number(params.amountInr) || 0);
  const safeRate = Math.max(0, Number(params.gstRatePct) || 0);
  const r = safeRate / 100;

  let baseAmount = safeAmount;
  let gstAmount = 0;
  let totalAmount = safeAmount;

  if (params.inclusive && r > 0) {
    baseAmount = safeAmount / (1 + r);
    gstAmount = safeAmount - baseAmount;
    totalAmount = safeAmount;
  } else {
    baseAmount = safeAmount;
    gstAmount = safeAmount * r;
    totalAmount = safeAmount + gstAmount;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const roundedGst = round2(gstAmount);
  const halfGst = round2(roundedGst / 2);

  return {
    baseAmount: round2(baseAmount),
    gstAmount: roundedGst,
    cgst: params.interState ? 0 : halfGst,
    sgst: params.interState ? 0 : round2(roundedGst - halfGst),
    igst: params.interState ? roundedGst : 0,
    totalAmount: round2(totalAmount),
  };
}

export interface IncomeTaxComparisonResult {
  taxableNew: number;
  taxableOld: number;
  newRegimeTax: number;
  oldRegimeTax: number;
  recommendedRegime: 'New Regime' | 'Old Regime';
  savingsInr: number;
}

function computeSlabTax(income: number, slabs: Array<{ limit: number; rate: number }>): number {
  let remaining = Math.max(0, income);
  let prevLimit = 0;
  let tax = 0;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const width = slab.limit === Infinity ? remaining : Math.max(0, slab.limit - prevLimit);
    const taxableInSlab = Math.min(remaining, width);
    tax += taxableInSlab * slab.rate;
    remaining -= taxableInSlab;
    prevLimit = slab.limit;
  }
  return tax;
}

export function calculateIncomeTaxFY2627(params: {
  annualIncomeInr: number;
  deductions80C80DInr: number;
  salaried: boolean;
}): IncomeTaxComparisonResult {
  const gross = Math.max(0, Number(params.annualIncomeInr) || 0);
  const extraDeductions = Math.max(0, Number(params.deductions80C80DInr) || 0);

  // New Regime FY 2026-27 (Std deduction 75k for salaried; 87A rebate up to ₹12L taxable)
  const stdDedNew = params.salaried ? 75000 : 0;
  const taxableNew = Math.max(0, gross - stdDedNew);
  let newBaseTax =
    taxableNew <= 1200000
      ? 0
      : computeSlabTax(taxableNew, [
          { limit: 400000, rate: 0 },
          { limit: 800000, rate: 0.05 },
          { limit: 1200000, rate: 0.1 },
          { limit: 1600000, rate: 0.15 },
          { limit: 2000000, rate: 0.2 },
          { limit: 2400000, rate: 0.25 },
          { limit: Infinity, rate: 0.3 },
        ]);
  // Marginal relief just above ₹12L
  if (taxableNew > 1200000 && newBaseTax > taxableNew - 1200000) {
    newBaseTax = taxableNew - 1200000;
  }
  const newRegimeTax = Math.round(newBaseTax * 1.04);

  // Old Regime (Std deduction 50k for salaried + Chapter VI-A; 87A rebate up to ₹5L taxable)
  const stdDedOld = params.salaried ? 50000 : 0;
  const taxableOld = Math.max(0, gross - stdDedOld - extraDeductions);
  const oldBaseTax =
    taxableOld <= 500000
      ? 0
      : computeSlabTax(taxableOld, [
          { limit: 250000, rate: 0 },
          { limit: 500000, rate: 0.05 },
          { limit: 1000000, rate: 0.2 },
          { limit: Infinity, rate: 0.3 },
        ]);
  const oldRegimeTax = Math.round(oldBaseTax * 1.04);

  const recommendedRegime = newRegimeTax <= oldRegimeTax ? 'New Regime' : 'Old Regime';
  const savingsInr = Math.abs(oldRegimeTax - newRegimeTax);

  return {
    taxableNew,
    taxableOld,
    newRegimeTax,
    oldRegimeTax,
    recommendedRegime,
    savingsInr,
  };
}

export const TaxComplianceEstimator: React.FC<{
  onNavigate: (route: string, param?: string) => void;
}> = ({ onNavigate }) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const isHi = lang === 'hi';

  // GST Calculator State
  const [gstAmount, setGstAmount] = useState<string>('10000');
  const [gstRate, setGstRate] = useState<number>(18);
  const [gstInclusive, setGstInclusive] = useState<boolean>(false);
  const [gstInterState, setGstInterState] = useState<boolean>(false);

  const gstResult = useMemo(
    () =>
      calculateGstBreakdown({
        amountInr: Number(gstAmount) || 0,
        gstRatePct: gstRate,
        inclusive: gstInclusive,
        interState: gstInterState,
      }),
    [gstAmount, gstRate, gstInclusive, gstInterState]
  );

  // Income Tax FY 2026-27 Comparator State
  const [annualIncome, setAnnualIncome] = useState<string>('1350000');
  const [deductions, setDeductions] = useState<string>('175000');
  const [salaried, setSalaried] = useState<boolean>(true);

  const taxResult = useMemo(
    () =>
      calculateIncomeTaxFY2627({
        annualIncomeInr: Number(annualIncome) || 0,
        deductions80C80DInr: Number(deductions) || 0,
        salaried,
      }),
    [annualIncome, deductions, salaried]
  );

  // Persistent Compliance Renewal Reminders State
  const [reminders, setReminders] = useState<ComplianceReminderRecord[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remCategory, setRemCategory] = useState('GST Filing');
  const [remDueDate, setRemDueDate] = useState('');
  const [remFrequency, setRemFrequency] = useState('Monthly');
  const [savingReminder, setSavingReminder] = useState(false);
  const [remNotice, setRemNotice] = useState<string | null>(null);

  const loadReminders = async () => {
    if (!user?.id) return;
    setLoadingReminders(true);
    try {
      const res = await fetchComplianceReminders();
      if (res.ok && Array.isArray(res.data)) {
        setReminders(res.data);
      }
    } finally {
      setLoadingReminders(false);
    }
  };

  useEffect(() => {
    void loadReminders();
  }, [user?.id]);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim() || !remDueDate) return;
    setSavingReminder(true);
    try {
      const res = await createComplianceReminder({
        title: remTitle.trim(),
        category: remCategory,
        dueDate: remDueDate,
        frequency: remFrequency,
      });
      if (res.ok) {
        setRemTitle('');
        setRemDueDate('');
        setRemNotice('Compliance reminder saved to your account.');
        await loadReminders();
      } else {
        setRemNotice(res.message || 'Could not save reminder.');
      }
    } finally {
      setSavingReminder(false);
    }
  };

  const handlePresetReminder = async (preset: {
    title: string;
    category: string;
    dueDate: string;
    frequency: string;
    relatedServiceSlug: string;
  }) => {
    setSavingReminder(true);
    try {
      const res = await createComplianceReminder(preset);
      if (res.ok) {
        setRemNotice(`Scheduled "${preset.title}".`);
        await loadReminders();
      }
    } finally {
      setSavingReminder(false);
    }
  };

  const handleToggleReminder = async (item: ComplianceReminderRecord) => {
    const nextStatus = item.status === 'Completed' ? 'Upcoming' : 'Completed';
    await updateComplianceReminder(item.id, nextStatus);
    setReminders((prev) => prev.map((r) => (r.id === item.id ? { ...r, status: nextStatus } : r)));
  };

  const handleDeleteReminder = async (id: string) => {
    await deleteComplianceReminder(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#FF671F]" />
              <span>
                {isHi
                  ? 'जीएसटी व आयकर कैलकुलेटर एवं अनुपालन रिमाइंडर'
                  : 'GST & Income Tax Calculator + Compliance Reminders'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isHi
                ? 'FY 2026-27 कर तुलना, जीएसटी चालान गणना और सरकारी नवीनीकरण अलर्ट प्रबंधित करें।'
                : 'Calculate GST invoice splits, compare FY 2026-27 New vs Old tax regimes, and schedule due-date alerts.'}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Compliance Renewal Reminders */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#138808]" />
              <span>{isHi ? 'व्यक्तिगत अनुपालन रिमाइंडर' : 'Personal Compliance & Renewal Reminders'}</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Track GST monthly filings, ITR due dates, DSC expiry, FSSAI & MSME renewals in one ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReminders()}
            className="self-start sm:self-auto text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            {loadingReminders ? <InlineSkeletonPulse className="w-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{loadingReminders ? 'Syncing' : 'Sync'}</span>
          </button>
        </div>

        {/* One-Click Presets */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {[
            {
              title: 'Monthly GSTR-3B Return Filing',
              category: 'GST Filing',
              dueDate: '2026-12-20',
              frequency: 'Monthly',
              relatedServiceSlug: 'gst-return-filing',
            },
            {
              title: 'Income Tax Return (ITR) Due Date',
              category: 'Income Tax',
              dueDate: '2027-07-31',
              frequency: 'Annual',
              relatedServiceSlug: 'itr-filing-salaried',
            },
            {
              title: 'Digital Signature (DSC) Renewal Check',
              category: 'DSC & Licensing',
              dueDate: '2027-03-15',
              frequency: 'Annual',
              relatedServiceSlug: 'dsc-class-3-individual',
            },
          ].map((preset) => (
            <button
              key={preset.title}
              type="button"
              disabled={savingReminder}
              onClick={() => void handlePresetReminder(preset)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:border-[#FF671F] cursor-pointer"
            >
              + {preset.title}
            </button>
          ))}
        </div>

        {remNotice && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            {remNotice}
          </div>
        )}

        <form onSubmit={handleAddReminder} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs">
          <input
            type="text"
            value={remTitle}
            onChange={(e) => setRemTitle(e.target.value)}
            placeholder="Reminder title (e.g. Shop Act License Renewal)"
            required
            className="sm:col-span-5 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
          />
          <select
            value={remCategory}
            onChange={(e) => setRemCategory(e.target.value)}
            className="sm:col-span-2 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white"
          >
            <option>GST Filing</option>
            <option>Income Tax</option>
            <option>DSC &amp; Licensing</option>
            <option>Vehicle &amp; RTO</option>
            <option>Passport &amp; ID</option>
          </select>
          <input
            type="date"
            value={remDueDate}
            onChange={(e) => setRemDueDate(e.target.value)}
            required
            className="sm:col-span-2 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white"
          />
          <select
            value={remFrequency}
            onChange={(e) => setRemFrequency(e.target.value)}
            className="sm:col-span-1 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-slate-900 dark:text-white"
          >
            <option>Once</option>
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Annual</option>
          </select>
          <button
            type="submit"
            disabled={savingReminder}
            className="sm:col-span-2 bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Alert</span>
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {loadingReminders && reminders.length === 0 ? (
            <div className="py-2">
              <ListRowsSkeleton rows={3} compact />
            </div>
          ) : reminders.length === 0 ? (
            <p className="py-4 text-slate-500 dark:text-slate-400 text-center">
              No active renewal reminders yet. Add a custom reminder or use a 1-click preset above.
            </p>
          ) : (
            reminders.map((r) => (
              <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleToggleReminder(r)}
                    className={`mt-0.5 p-1 rounded-md border cursor-pointer ${
                      r.status === 'Completed'
                        ? 'bg-emerald-100 border-emerald-300 text-[#138808]'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <div>
                    <div
                      className={`font-bold ${
                        r.status === 'Completed'
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {r.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Due: <strong className="font-mono">{r.due_date}</strong> · {r.category} · {r.frequency}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {r.related_service_slug && (
                    <button
                      type="button"
                      onClick={() => onNavigate('service-detail', r.related_service_slug!)}
                      className="text-[11px] font-bold text-[#FF671F] hover:underline cursor-pointer"
                    >
                      File Service →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteReminder(r.id)}
                    aria-label="Delete reminder"
                    className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Side-by-Side GST Calculator & FY 2026-27 Income Tax Comparator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* GST Calculator */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-[#FF671F]" />
              <span>GST Tax &amp; Invoice Calculator</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('service-detail', 'gst-registration')}
              className="text-[11px] font-bold text-[#FF671F] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>GST Registration</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount (INR)
              </label>
              <input
                type="number"
                min={0}
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GST Slab Rate
              </label>
              <select
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-900 dark:text-white"
              >
                <option value={5}>5% (Essential Goods/Services)</option>
                <option value={12}>12% (Standard Slab)</option>
                <option value={18}>18% (B2B Consultancy &amp; SaaS)</option>
                <option value={28}>28% (Luxury / Auto)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={gstInclusive}
                onChange={(e) => setGstInclusive(e.target.checked)}
              />
              <span>Amount is GST-Inclusive</span>
            </label>
            <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={gstInterState}
                onChange={(e) => setGstInterState(e.target.checked)}
              />
              <span>Inter-State Supply (IGST)</span>
            </label>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 tabular-nums font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Net Taxable Value</span>
              <strong className="text-slate-900 dark:text-white">₹{gstResult.baseAmount.toLocaleString('en-IN')}</strong>
            </div>
            {gstInterState ? (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">IGST ({gstRate}%)</span>
                <strong className="text-[#FF671F]">₹{gstResult.igst.toLocaleString('en-IN')}</strong>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">CGST ({gstRate / 2}%)</span>
                  <strong className="text-slate-800 dark:text-slate-200">₹{gstResult.cgst.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">SGST ({gstRate / 2}%)</span>
                  <strong className="text-slate-800 dark:text-slate-200">₹{gstResult.sgst.toLocaleString('en-IN')}</strong>
                </div>
              </>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm">
              <span className="font-bold text-slate-800 dark:text-white">Gross Invoice Total</span>
              <strong className="text-[#138808] dark:text-emerald-400">
                ₹{gstResult.totalAmount.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        {/* Income Tax FY 2026-27 Regime Comparator */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#138808]" />
              <span>FY 2026-27 Income Tax Regime Comparator</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('service-detail', 'itr-filing-salaried')}
              className="text-[11px] font-bold text-[#FF671F] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>File ITR</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gross Annual Income (INR)
              </label>
              <input
                type="number"
                min={0}
                value={annualIncome}
                onChange={(e) => setAnnualIncome(e.target.value)}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Old Regime Deductions (80C/80D/HRA)
              </label>
              <input
                type="number"
                min={0}
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={salaried}
              onChange={(e) => setSalaried(e.target.checked)}
            />
            <span>Salaried Individual (includes ₹75,000 New / ₹50,000 Old Standard Deduction)</span>
          </label>

          <div className="grid grid-cols-2 gap-3 tabular-nums">
            <div
              className={`p-3.5 rounded-xl border ${
                taxResult.recommendedRegime === 'New Regime'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-[#138808]'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                New Regime (Incl. 4% Cess)
              </div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                ₹{taxResult.newRegimeTax.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Taxable: ₹{taxResult.taxableNew.toLocaleString('en-IN')}
              </div>
            </div>
            <div
              className={`p-3.5 rounded-xl border ${
                taxResult.recommendedRegime === 'Old Regime'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-[#138808]'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                Old Regime (Incl. 4% Cess)
              </div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                ₹{taxResult.oldRegimeTax.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Taxable: ₹{taxResult.taxableOld.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="p-3 bg-orange-50/60 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-900/50 rounded-xl text-slate-800 dark:text-slate-200 font-semibold">
            Recommended: <strong className="text-[#138808] dark:text-emerald-400">{taxResult.recommendedRegime}</strong>{' '}
            {taxResult.savingsInr > 0
              ? `(saves ₹${taxResult.savingsInr.toLocaleString('en-IN')} annually)`
              : '(equal liability)'}
          </div>
        </div>
      </div>
    </div>
  );
};
