import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from 'lucide-react';
import {
  ApplicationProgressResult,
  ApplicationProgressTone,
  KycProgressResult,
  KycProgressTone,
  ProgressStepItem,
  ProgressStepState,
} from '../../lib/workflow';

interface ProgressBarTrackProps {
  percent: number;
  barClassName: string;
  label: string;
  heightClass?: string;
}

const ProgressBarTrack: React.FC<ProgressBarTrackProps> = ({
  percent,
  barClassName,
  label,
  heightClass = 'h-2',
}) => {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={`w-full ${heightClass} rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden`}>
      <svg
        className={`w-full h-full block ${barClassName}`}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        role="progressbar"
        aria-label={label}
        aria-valuenow={safePercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {safePercent > 0 && (
          <rect
            x="0"
            y="0"
            width={safePercent}
            height="8"
            rx="4"
            className="fill-current transition-all duration-300"
          />
        )}
      </svg>
    </div>
  );
};

function getKycToneStyles(tone: KycProgressTone) {
  switch (tone) {
    case 'approved':
      return {
        bar: 'text-[#138808] dark:text-emerald-500',
        badge:
          'bg-emerald-50 dark:bg-emerald-950/50 text-[#138808] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        percent: 'text-[#138808] dark:text-emerald-400',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-[#138808] dark:text-emerald-400',
        Icon: ShieldCheck,
      };
    case 'pending':
      return {
        bar: 'text-amber-500 dark:text-amber-400',
        badge:
          'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        percent: 'text-amber-700 dark:text-amber-400',
        iconBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
        Icon: Clock,
      };
    case 'warning':
      return {
        bar: 'text-[#FF671F] dark:text-orange-400',
        badge:
          'bg-orange-50 dark:bg-orange-950/50 text-[#C2410C] dark:text-orange-300 border-orange-200 dark:border-orange-800',
        percent: 'text-[#FF671F] dark:text-orange-400',
        iconBg: 'bg-orange-50 dark:bg-orange-950/50 text-[#FF671F] dark:text-orange-400',
        Icon: ShieldAlert,
      };
    case 'rejected':
      return {
        bar: 'text-rose-600 dark:text-rose-500',
        badge:
          'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        percent: 'text-rose-600 dark:text-rose-400',
        iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
        Icon: XCircle,
      };
    default:
      return {
        bar: 'text-slate-500 dark:text-slate-400',
        badge:
          'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
        percent: 'text-slate-700 dark:text-slate-300',
        iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
        Icon: ShieldQuestion,
      };
  }
}

function getAppToneStyles(tone: ApplicationProgressTone) {
  switch (tone) {
    case 'completed':
      return {
        bar: 'text-[#138808] dark:text-emerald-500',
        text: 'text-[#138808] dark:text-emerald-400',
        panel:
          'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/60',
      };
    case 'active':
      return {
        bar: 'text-[#FF671F] dark:text-orange-400',
        text: 'text-[#FF671F] dark:text-orange-400',
        panel: 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50',
      };
    case 'pending':
      return {
        bar: 'text-amber-500 dark:text-amber-400',
        text: 'text-amber-700 dark:text-amber-400',
        panel: 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50',
      };
    case 'attention':
      return {
        bar: 'text-rose-600 dark:text-rose-500',
        text: 'text-rose-700 dark:text-rose-400',
        panel: 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/60',
      };
    case 'halted':
      return {
        bar: 'text-slate-500 dark:text-slate-400',
        text: 'text-slate-700 dark:text-slate-300',
        panel: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
      };
  }
}

function renderStepMarker(state: ProgressStepState) {
  switch (state) {
    case 'done':
      return (
        <span className="w-5 h-5 rounded-full bg-[#138808] dark:bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
      );
    case 'current':
      return (
        <span className="w-5 h-5 rounded-full bg-amber-500 dark:bg-amber-500 text-white flex items-center justify-center shrink-0">
          <Clock className="w-3.5 h-3.5" />
        </span>
      );
    case 'attention':
      return (
        <span className="w-5 h-5 rounded-full bg-[#FF671F] dark:bg-orange-500 text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
        </span>
      );
    case 'halted':
      return (
        <span className="w-5 h-5 rounded-full bg-rose-600 dark:bg-rose-600 text-white flex items-center justify-center shrink-0">
          <XCircle className="w-3.5 h-3.5" />
        </span>
      );
    default:
      return (
        <span className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 flex items-center justify-center text-[10px] font-mono shrink-0">
          ·
        </span>
      );
  }
}

function getStepLabelClass(state: ProgressStepState) {
  switch (state) {
    case 'done':
      return 'text-[#138808] dark:text-emerald-400 font-semibold';
    case 'current':
      return 'text-slate-900 dark:text-white font-bold';
    case 'attention':
      return 'text-[#C2410C] dark:text-orange-300 font-bold';
    case 'halted':
      return 'text-rose-700 dark:text-rose-400 font-bold';
    default:
      return 'text-slate-400 dark:text-slate-500 font-medium';
  }
}

interface KycVerificationProgressBannerProps {
  progress: KycProgressResult;
  onAction: () => void;
}

export const KycVerificationProgressBanner: React.FC<KycVerificationProgressBannerProps> = ({
  progress,
  onAction,
}) => {
  const tone = getKycToneStyles(progress.tone);
  const StatusIcon = tone.Icon;

  return (
    <section
      aria-label="KYC verification progress"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.iconBg}`}>
            <StatusIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {progress.headline}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border whitespace-nowrap shrink-0 ${tone.badge}`}
              >
                <StatusIcon className="w-3 h-3 shrink-0" />
                <span>{progress.statusBadgeLabel}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {progress.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="text-left sm:text-right">
            <div className={`text-lg font-black font-mono tabular-nums leading-none ${tone.percent}`}>
              {progress.percent}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              KYC Progress
            </div>
          </div>

          <button
            type="button"
            onClick={onAction}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{progress.ctaLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <ProgressBarTrack
        percent={progress.percent}
        barClassName={tone.bar}
        label={`KYC verification progress ${progress.percent}% (${progress.statusBadgeLabel})`}
        heightClass="h-2.5"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {progress.steps.map((step: ProgressStepItem, idx: number) => (
          <div
            key={step.key}
            className="flex items-center gap-2 text-[11px] min-w-0"
          >
            {renderStepMarker(step.state)}
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                Step {idx + 1}
              </div>
              <div className={`truncate ${getStepLabelClass(step.state)}`}>{step.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

interface ApplicationProgressTrackerProps {
  progress: ApplicationProgressResult;
  variant?: 'compact' | 'detailed';
}

export const ApplicationProgressTracker: React.FC<ApplicationProgressTrackerProps> = ({
  progress,
  variant = 'compact',
}) => {
  const styles = getAppToneStyles(progress.tone);
  const currentStage = progress.steps[progress.currentStepIndex]?.label || progress.statusBadgeLabel;

  if (variant === 'compact') {
    return (
      <div className="space-y-1.5 w-full">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
            Stage {progress.currentStepIndex + 1} of {progress.steps.length}:{' '}
            <strong className={styles.text}>{currentStage}</strong>
          </span>
          <span className={`font-mono font-bold tabular-nums shrink-0 ${styles.text}`}>
            {progress.percent}%
          </span>
        </div>
        <ProgressBarTrack
          percent={progress.percent}
          barClassName={styles.bar}
          label={`Application progress ${progress.percent}% (${progress.statusBadgeLabel})`}
          heightClass="h-1.5"
        />
      </div>
    );
  }

  return (
    <div className={`p-4 sm:p-5 rounded-xl border space-y-4 ${styles.panel}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Application Lifecycle Progress
          </div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {progress.summaryLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-base font-black font-mono tabular-nums ${styles.text}`}>
            {progress.percent}%
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            ({currentStage})
          </span>
        </div>
      </div>

      <ProgressBarTrack
        percent={progress.percent}
        barClassName={styles.bar}
        label={`Application progress ${progress.percent}% (${progress.statusBadgeLabel})`}
        heightClass="h-2.5"
      />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
        {progress.steps.map((step: ProgressStepItem, idx: number) => (
          <div key={step.key} className="flex items-center gap-2 text-[11px] min-w-0">
            {renderStepMarker(step.state)}
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                0{idx + 1}
              </div>
              <div className={`truncate ${getStepLabelClass(step.state)}`}>{step.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
