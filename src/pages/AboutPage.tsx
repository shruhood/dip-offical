import React from 'react';
import { useData } from '../context/DataContext';
import {
  ShieldAlert,
  CheckCircle2,
  Target,
  Award,
  Lock,
  ArrowRight,
  Building2,
} from 'lucide-react';

export const AboutPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  const { businessSettings } = useData();
  const gstin = businessSettings.gstin || '26EXIPK0151F1ZQ';
  const udyam = businessSettings.udyamNumber || 'UDYAM-DD-03-0009994';
  const duns = businessSettings.dunsNumber || '308198649';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Top Hero */}
      <div className="bg-gradient-to-r from-[#FFFDF8] via-white to-[#F7F8FA] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center max-w-4xl mx-auto space-y-4">
        <div className="text-[11px] font-bold text-[#FF671F] uppercase tracking-[0.14em]">
          Private Business Positioning
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          About {businessSettings.legalName}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Digital India Project is an independent, technology-driven digital services and online registration assistance enterprise based in Silvassa, Dadra &amp; Nagar Haveli and Daman &amp; Diu, India.
        </p>
      </div>

      {/* Verified Enterprise Identifiers */}
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
          <Building2 className="w-5 h-5 text-[#FF671F]" />
          <span>Official Statutory &amp; Enterprise Credentials</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
          <div className="p-4 bg-[#F7F8FA] dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GST Registration Number</div>
            <div className="text-sm font-black font-mono text-slate-900 dark:text-white mt-1">{gstin}</div>
          </div>
          <div className="p-4 bg-[#F7F8FA] dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Udyam MSME Registration</div>
            <div className="text-sm font-black font-mono text-slate-900 dark:text-white mt-1">{udyam}</div>
          </div>
          <div className="p-4 bg-[#F7F8FA] dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">D-U-N-S® Number</div>
            <div className="text-sm font-black font-mono text-slate-900 dark:text-white mt-1">{duns}</div>
          </div>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Registered Office: {businessSettings.registeredAddress}
        </div>
      </div>

      {/* Transparent Positioning Notice */}
      <div className="p-6 bg-[#FFFDF8] dark:bg-slate-900 border-2 border-[#FFC928]/40 rounded-2xl space-y-3 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
          <ShieldAlert className="w-5 h-5 text-[#FF671F]" />
          <span>Our Business Mandate &amp; Transparent Positioning</span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          We operate exclusively as a <strong>private assistance and documentation firm</strong>. We assist citizens, entrepreneurs, and established firms navigate online registration procedures across PAN, GST, Udyam MSME, FSSAI, and Ministry of Corporate Affairs portals.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
            <span>We are an independent private business.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
            <span>We do not claim to be a government department.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
            <span>We provide professional filing assistance.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
            <span>Official statutory approval rests with authorities.</span>
          </div>
        </div>
      </div>

      {/* Core Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-[#FF671F] flex items-center justify-center font-bold">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Accuracy &amp; Rejection Prevention</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Every submission undergoes pre-filing audit to ensure spellings, addresses, and documentation proofs strictly conform to statutory standards.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-emerald-950/50 text-[#138808] flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Transparent Costing</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            We clearly decouple our nominal professional service fee from official government charges. No hidden processing surcharges.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Data Privacy &amp; Security</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Customer credentials and identification proofs are stored in encrypted private vaults with strict role-scoped access control.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pt-2">
        <button
          onClick={() => onNavigate('services')}
          className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition inline-flex items-center gap-2 cursor-pointer"
        >
          <span>Explore All 16+ Digital Services</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
