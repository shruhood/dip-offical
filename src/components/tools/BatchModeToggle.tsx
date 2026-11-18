import React from 'react';
import { Layers } from 'lucide-react';

interface BatchModeToggleProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  queuedCount?: number;
  disabled?: boolean;
  note?: string;
}

export const BatchModeToggle: React.FC<BatchModeToggleProps> = ({
  enabled,
  onToggle,
  queuedCount = 0,
  disabled = false,
  note,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210]">
      <div className="flex items-start gap-2.5 min-w-0">
        <Layers
          className={`w-4 h-4 shrink-0 mt-0.5 ${
            enabled ? 'text-[#D97706] dark:text-[#F5C542]' : 'text-[#707070]'
          }`}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#252525] dark:text-[#F4F3EE]">
            <span>Batch Process Mode</span>
            {enabled && queuedCount > 0 && (
              <span className="text-xs font-medium text-[#707070] dark:text-[#A6A49C] tabular-nums">
                · {queuedCount} {queuedCount === 1 ? 'file' : 'files'} queued
              </span>
            )}
          </div>
          <p className="text-xs text-[#707070] dark:text-[#A6A49C] mt-0.5">
            {note ||
              (enabled
                ? 'Simultaneous multi-file conversion active. Download files individually or as a ZIP archive.'
                : 'Enable to upload multiple files at once for simultaneous processing.')}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center disabled:opacity-60 ${
          enabled
            ? 'border-[#F5C542] bg-[#F5C542]/15 text-[#252525] dark:text-[#F4F3EE]'
            : 'border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] text-[#555550] dark:text-[#C5C3BA] hover:border-[#F5C542]'
        }`}
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
            enabled ? 'bg-[#F5C542]' : 'bg-[#D4D4CE] dark:bg-[#3A3A33]'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-[#252525] transition-transform ${
              enabled ? 'translate-x-3.5' : 'translate-x-0.5'
            }`}
          />
        </span>
        <span>{enabled ? 'Batch ON' : 'Batch Process'}</span>
      </button>
    </div>
  );
};
