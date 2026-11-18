import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Handshake,
  Building2,
  CheckCircle2,
  ArrowRight,
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  Briefcase,
  Wallet,
  KeyRound,
  FileCheck2,
  Calculator,
  Award,
  Sparkles,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  PARTNER_TRACKS,
  PLATFORM_FEE_SCHEDULE,
  PartnerTrackId,
  estimatePartnerEarnings,
} from '../../lib/partnerProgram';

interface BecomePartnerPageProps {
  onNavigate: (route: string, param?: string) => void;
  initialTrack?: string;
}

const TRACK_ICON_MAP: Record<PartnerTrackId, React.ComponentType<{ className?: string }>> = {
  operator: UserCheck,
  distributor: Handshake,
  b2b: Building2,
};

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export const BecomePartnerPage: React.FC<BecomePartnerPageProps> = ({
  onNavigate,
  initialTrack,
}) => {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const resolveTrack = (raw?: string): PartnerTrackId => {
    if (raw === 'distributor' || raw === 'partner') return 'distributor';
    if (raw === 'b2b' || raw === 'business') return 'b2b';
    return 'operator';
  };

  const [selectedTrack, setSelectedTrack] = useState<PartnerTrackId>(() =>
    resolveTrack(initialTrack)
  );
  const [monthlyVolume, setMonthlyVolume] = useState<number>(35);

  useEffect(() => {
    if (initialTrack) setSelectedTrack(resolveTrack(initialTrack));
  }, [initialTrack]);

  const activeSpec =
    PARTNER_TRACKS.find((t) => t.id === selectedTrack) || PARTNER_TRACKS[0];

  const earningsProjection = useMemo(
    () => estimatePartnerEarnings(selectedTrack, monthlyVolume),
    [selectedTrack, monthlyVolume]
  );

  const handleStartRegistration = (accountType: 'operator' | 'partner' | 'business') => {
    if (user) {
      const normalizedRole = String(user.role || '').toLowerCase();
      if (accountType === 'operator' && (normalizedRole === 'operator' || user.accountType === 'operator')) {
        onNavigate('operator-enroll');
        return;
      }
      if (accountType === 'partner' && (normalizedRole === 'partner' || user.accountType === 'partner')) {
        onNavigate('partner');
        return;
      }
      if (
        accountType === 'business' &&
        (normalizedRole === 'business' || normalizedRole === 'b2b' || user.accountType === 'business')
      ) {
        onNavigate('b2b', 'kyc');
        return;
      }
    }
    onNavigate('register', accountType);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0B1120] pb-16">
      {/* Executive Dark Hero */}
      <section className="bg-[#1E293B] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FFC928]">
                {lang === 'hi'
                  ? 'डिजिटल इंडिया प्रोजेक्ट · ऑपरेटर, डिस्ट्रीब्यूटर और B2B पार्टनर कार्यक्रम'
                  : 'Digital India Project · Official Channel Partner Programme'}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-balance">
                {lang === 'hi'
                  ? 'हमारे साथ जुड़ें — ऑपरेटर, डिस्ट्रीब्यूटर या B2B पार्टनर बनें'
                  : 'Become Our Partner — Grow as an Operator, Distributor or B2B Enterprise'}
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Deliver 149+ citizen documentation, GST, MSME, taxation, and bulk API verification workflows with transparent platform fees, verifiable commission ledgers, and fast 24–48 hour KYC onboarding.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleStartRegistration('operator')}
                  className="bg-[#138808] hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-xl inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Register as Operator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartRegistration('partner')}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-xl inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Handshake className="w-4 h-4" />
                  <span>Register as Distributor</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStartRegistration('business')}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-xl inline-flex items-center gap-2 transition cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-[#FFC928]" />
                  <span>B2B Partner Registration</span>
                </button>
              </div>
            </div>

            {/* Key Program Metrics */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3 tabular-nums">
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Earning Potential</div>
                <div className="text-xl sm:text-2xl font-black text-[#FFC928]">15% – 40%</div>
                <div className="text-[11px] text-slate-300">Role-based share &amp; wholesale margin</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Live Services &amp; Kits</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">149+</div>
                <div className="text-[11px] text-slate-300">Citizen, GST, MSME, API &amp; Bundles</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Base Signup Fee</div>
                <div className="text-xl sm:text-2xl font-black text-white">₹0 Free</div>
                <div className="text-[11px] text-slate-300">Optional tier activation packs</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">KYC Verification</div>
                <div className="text-xl sm:text-2xl font-black text-sky-400">24 – 48 hrs</div>
                <div className="text-[11px] text-slate-300">Dedicated Admin KYC Review</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
        {/* 3 Partnership Models At A Glance */}
        <section className="space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
              Three Dedicated Growth Tracks
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Choose the Partnership Track Built for Your Practice
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {PARTNER_TRACKS.map((track) => {
              const Icon = TRACK_ICON_MAP[track.id];
              const isSelected = selectedTrack === track.id;
              return (
                <article
                  key={track.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 flex flex-col justify-between gap-5 transition ${
                    isSelected
                      ? 'border-slate-900 dark:border-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div
                          className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: track.accentHex }}
                        >
                          {track.tagline}
                        </div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {lang === 'hi' ? track.titleHi : track.title}
                        </h3>
                      </div>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ backgroundColor: track.accentHex }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {track.subtitle}
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 tabular-nums">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Potential Earnings
                        </div>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                          {track.earningRange}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Onboarding Fee
                        </div>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                          {track.registrationFee}
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      {track.benefits.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#138808] shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTrack(track.id)}
                      className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#FF671F] cursor-pointer"
                    >
                      {isSelected ? 'Viewing Details Below' : 'Inspect Full Breakdown'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartRegistration(track.signupAccountType)}
                      className="px-3.5 py-2 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition hover:opacity-90"
                      style={{ backgroundColor: track.accentHex }}
                    >
                      <span>Apply Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Interactive Track Deep-Dive */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
                Role-Wise Breakdown
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                Benefits, Sample Earnings, Platform Fees &amp; KYC Checklist
              </h2>
            </div>

            <div className="inline-flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-1">
              {PARTNER_TRACKS.map((track) => {
                const Icon = TRACK_ICON_MAP[track.id];
                const active = selectedTrack === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setSelectedTrack(track.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      active
                        ? 'text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    style={active ? { backgroundColor: track.accentHex } : undefined}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>
                      {track.id === 'b2b'
                        ? 'B2B Partner'
                        : track.id === 'distributor'
                        ? 'Distributor'
                        : 'Operator'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Track Deep-Dive Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div
                  className="flex items-center gap-2 text-xs font-bold"
                  style={{ color: activeSpec.accentHex }}
                >
                  <Award className="w-4 h-4" />
                  <span>{activeSpec.commissionRate}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {lang === 'hi' ? activeSpec.titleHi : activeSpec.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeSpec.subtitle}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0">
                <div className="text-left lg:text-right">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Indicative Monthly Potential
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                    {activeSpec.earningRange}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartRegistration(activeSpec.signupAccountType)}
                  className="px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer"
                  style={{ backgroundColor: activeSpec.accentHex }}
                >
                  <span>
                    Start{' '}
                    {activeSpec.id === 'b2b'
                      ? 'B2B Partner'
                      : activeSpec.id === 'distributor'
                      ? 'Distributor'
                      : 'Operator'}{' '}
                    Registration
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
              {/* Benefits + Requirements Column */}
              <div className="lg:col-span-5 p-6 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    <Sparkles className="w-4 h-4 text-[#FF671F]" />
                    <span>Core Track Benefits</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {activeSpec.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-[#F7F8FA] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-[#138808]" />
                    <span>Mandatory Registration Documents</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    {activeSpec.registrationRequirements.documents.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-bold text-slate-400">•</span>
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <strong>KYC Gate:</strong> {activeSpec.kycGateLabel} ({activeSpec.registrationRequirements.approvalSla})
                  </div>
                </div>
              </div>

              {/* Earning Examples Column */}
              <div className="lg:col-span-4 p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  <TrendingUp className="w-4 h-4 text-[#138808]" />
                  <span>Sample Earnings per Filing</span>
                </div>
                <div className="space-y-2.5">
                  {activeSpec.earningExamples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1 tabular-nums"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {ex.service}
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">Client Fee: {ex.clientFee}</span>
                        <span className="font-bold text-[#138808] dark:text-emerald-400">
                          {ex.partnerShare}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
                    <span>Settlement Cycle: {activeSpec.settlementCycle}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    <strong>Best suited for:</strong> {activeSpec.idealFor}
                  </p>
                </div>
              </div>

              {/* Platform Fees Column */}
              <div className="lg:col-span-3 p-6 space-y-4 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  <IndianRupee className="w-4 h-4 text-[#FF671F]" />
                  <span>Platform Fees</span>
                </div>
                <div className="space-y-3 tabular-nums">
                  {activeSpec.chargeBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="pb-3 border-b border-slate-200 dark:border-slate-800 last:border-b-0 last:pb-0 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {item.label}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white shrink-0">
                          {item.amount}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Monthly Earnings & Platform Fee Estimator */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#138808]">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Interactive Earnings &amp; Fee Calculator</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Estimate Monthly Potential Earnings for Your Practice
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjust expected monthly filings or enterprise verifications to preview gross volume, platform fees, statutory TDS, and estimated net take-home.
              </p>
            </div>

            <div className="w-full lg:w-80 space-y-2 tabular-nums">
              <div className="flex items-center justify-between text-xs font-bold">
                <label htmlFor="partner-volume-slider" className="text-slate-700 dark:text-slate-200">
                  Monthly Verified Orders
                </label>
                <span className="text-[#FF671F] font-mono text-sm">
                  {monthlyVolume} orders / mo
                </span>
              </div>
              <input
                id="partner-volume-slider"
                type="range"
                min={5}
                max={200}
                step={5}
                value={monthlyVolume}
                onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                className="w-full accent-[#FF671F] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>5 / mo</span>
                <span>50 / mo</span>
                <span>100 / mo</span>
                <span>200 / mo</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 tabular-nums">
            <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Gross Client Fee Volume
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {formatInr(earningsProjection.grossClientFeesInr)}
              </div>
              <div className="text-[11px] text-slate-500">
                Avg order {formatInr(activeSpec.avgOrderValueInr)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Partner Share ({earningsProjection.commissionRatePercent}%)
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {formatInr(earningsProjection.grossPartnerShareInr)}
              </div>
              <div className="text-[11px] text-slate-500">{activeSpec.commissionRate}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Monthly Platform Fee
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {formatInr(earningsProjection.estimatedPlatformFeeInr)}
              </div>
              <div className="text-[11px] text-slate-500">
                {earningsProjection.estimatedPlatformFeeInr === 0
                  ? 'Zero recurring base fee'
                  : 'Tracking / API baseline'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Statutory TDS (5% u/s 194H)
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {formatInr(earningsProjection.estimatedTdsInr)}
              </div>
              <div className="text-[11px] text-slate-500">
                {selectedTrack === 'b2b' ? 'B2B GST tax invoice billing' : 'Credited to PAN Form 26AS'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-1">
              <div className="text-[11px] font-bold text-[#138808] dark:text-emerald-400">
                Estimated Net Monthly Payout
              </div>
              <div className="text-xl font-black text-[#138808] dark:text-emerald-300">
                {formatInr(earningsProjection.netEstimatedEarningsInr)}
              </div>
              <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                {activeSpec.settlementCycle}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <strong>Earnings Disclosure:</strong> Figures above are illustrative projections based on proposed professional fee averages across our 149+ catalogue items. Actual partner earnings depend on verified application completions, selected service mix, client demand, and statutory TDS rules.
          </p>
        </section>

        {/* Complete Platform Fees & Service Charges Table */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
                Category H · Transparent Schedule
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                Complete Platform Fees &amp; Onboarding Charges
              </h3>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              All INR fees exclude 18% GST where applicable · Govt fees billed separately at actuals
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse tabular-nums">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-bold">Fee Item / Service Module</th>
                  <th className="py-3 px-4 font-bold">Track</th>
                  <th className="py-3 px-4 font-bold">Amount (INR)</th>
                  <th className="py-3 px-4 font-bold">Billing Cycle</th>
                  <th className="py-3 px-4 font-bold">Scope &amp; Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {PLATFORM_FEE_SCHEDULE.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{row.item}</td>
                    <td className="py-3 px-4 font-semibold">{row.applicableTrack}</td>
                    <td className="py-3 px-4 font-black text-[#138808] dark:text-emerald-400">
                      {row.feeAmount}
                    </td>
                    <td className="py-3 px-4">{row.billingCycle}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Registration Requirements Breakdown (All 3 Roles) */}
        <section className="space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#138808]">
              Eligibility &amp; Compliance Checklist
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              Registration &amp; KYC Verification Requirements by Role
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {PARTNER_TRACKS.map((track) => {
              const Icon = TRACK_ICON_MAP[track.id];
              return (
                <div
                  key={`req-${track.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: track.accentHex }}>
                        {track.kycGateLabel}
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                        {track.title}
                      </div>
                    </div>
                    <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Eligibility
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {track.registrationRequirements.eligibility.map((eItem, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#138808] shrink-0 mt-0.5" />
                          <span>{eItem}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Required Proofs
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {track.registrationRequirements.documents.map((dItem, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <FileCheck2 className="w-3.5 h-3.5 text-[#FF671F] shrink-0 mt-0.5" />
                          <span>{dItem}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">
                      SLA: <strong className="text-slate-800 dark:text-slate-200">{track.registrationRequirements.approvalSla}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartRegistration(track.signupAccountType)}
                      className="font-bold hover:underline cursor-pointer"
                      style={{ color: track.accentHex }}
                    >
                      Register →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Side-by-Side Comparison Matrix */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Partner Track Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sensitive Partner &amp; Operator KYC menus stay hidden from citizen accounts and unlock automatically only for verified Operator or B2B Partner accounts.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse tabular-nums">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-bold">Parameter</th>
                  <th className="py-3 px-4 font-bold text-[#138808]">Authorized Operator</th>
                  <th className="py-3 px-4 font-bold text-[#FF671F]">Distributor / Partner</th>
                  <th className="py-3 px-4 font-bold text-blue-600">B2B Enterprise &amp; API</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Primary Role</td>
                  <td className="py-3 px-4">Walk-in center intake &amp; local citizen fulfillment</td>
                  <td className="py-3 px-4">Referral links, territory leads &amp; assisted filings</td>
                  <td className="py-3 px-4">Bulk verification APIs &amp; corporate compliance</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Earning / Margin</td>
                  <td className="py-3 px-4 font-bold text-[#138808]">15% – 30% per service</td>
                  <td className="py-3 px-4 font-bold text-[#FF671F]">18% – 35% commission</td>
                  <td className="py-3 px-4 font-bold text-blue-600">Up to 40% B2B volume margin</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Base Signup Fee</td>
                  <td className="py-3 px-4">₹0 Free Signup</td>
                  <td className="py-3 px-4">₹0 Free Referral Starter</td>
                  <td className="py-3 px-4">₹0 Sandbox Key</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Activation / KYC Fee</td>
                  <td className="py-3 px-4 font-bold">₹999 One-time</td>
                  <td className="py-3 px-4 font-bold">₹1,999 Territory Pack</td>
                  <td className="py-3 px-4 font-bold">₹4,999 (incl. ₹2,500 credits)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">KYC Gate</td>
                  <td className="py-3 px-4">Operator KYC Portal (PAN + Aadhaar + Shop Photo)</td>
                  <td className="py-3 px-4">Partner Onboarding &amp; Bank Payout Verification</td>
                  <td className="py-3 px-4">Partner &amp; B2B Corporate KYB (GSTIN + Signatory PAN)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Action</td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleStartRegistration('operator')}
                      className="text-[#138808] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Join as Operator</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleStartRegistration('partner')}
                      className="text-[#FF671F] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Join as Distributor</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleStartRegistration('business')}
                      className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Register B2B</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4-Step Verification Flow */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Choose Partner Role',
              desc: 'Create an account explicitly under Operator, Distributor/Partner, or B2B Enterprise.',
              icon: Briefcase,
            },
            {
              step: '02',
              title: 'Role-Gated KYC Access',
              desc: 'Partner & Operator KYC workflows unlock strictly for registered Operator or B2B roles.',
              icon: KeyRound,
            },
            {
              step: '03',
              title: 'Submit PAN / KYB Docs',
              desc: 'Upload masked Aadhaar, PAN, bank cheque, center proof, or GSTIN for 24–48 hr review.',
              icon: FileCheck2,
            },
            {
              step: '04',
              title: 'Go Live & Earn',
              desc: 'Unlock Operator Desk queues, Territory Commission Ledger payouts, or Production B2B API keys.',
              icon: Calculator,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#FF671F]">STEP {item.step}</span>
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};
