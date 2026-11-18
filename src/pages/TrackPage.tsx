import React from 'react';
import { TrackingWidget } from '../components/tracking/TrackingWidget';
import { ShieldCheck, HelpCircle, ArrowRight } from 'lucide-react';

export const TrackPage: React.FC<{ onNavigate: (route: string) => void }> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF671F] uppercase tracking-wider bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-[#138808]" />
          <span>Real-Time Status Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Track Your Digital Application
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          Enter your Application ID (e.g. DIP-2026-XXXXX) and registered mobile or email to view the live status, operator remarks, and download completion certificates.
        </p>
      </div>

      {/* Main interactive tracking widget */}
      <TrackingWidget />

      {/* Security & FAQ notice */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl text-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <HelpCircle className="w-4 h-4 text-[#FF671F]" />
          <span>Need Help Finding Your Application ID?</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Your unique Application ID was sent via SMS and email confirmation immediately upon Cashfree payment completion. It starts with the prefix <strong>DIP-2026-XXXXX</strong>. If you are unable to find it, please check your spam folder or contact our support desk at{' '}
          <a href="mailto:support@digitalindiaproject.com" className="text-[#FF671F] font-semibold underline">
            support@digitalindiaproject.com
          </a>.
        </p>
      </div>
    </div>
  );
};
