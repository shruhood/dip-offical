import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Download,
  Archive,
  X,
  FileText,
} from 'lucide-react';
import type { BatchQueueItem } from '../../lib/batchProcessor';

interface BatchResultsPanelProps {
  items: BatchQueueItem[];
  processing: boolean;
  zipBusy?: boolean;
  onRemoveItem: (id: string) => void;
  onDownloadItem: (item: BatchQueueItem) => void;
  onDownloadAllZip: () => void;
}

export const BatchResultsPanel: React.FC<BatchResultsPanelProps> = ({
  items,
  processing,
  zipBusy = false,
  onRemoveItem,
  onDownloadItem,
  onDownloadAllZip,
}) => {
  if (items.length === 0) return null;

  const doneItems = items.filter((it) => it.status === 'done' && it.output);
  const failedCount = items.filter((it) => it.status === 'error').length;
  const totalOutBytes = doneItems.reduce((acc, it) => acc + (it.output?.blob.size || 0), 0);

  return (
    <div className="rounded-xl border border-[#EAEAEA] dark:border-[#2C2C27] bg-[#FAFAF7] dark:bg-[#121210] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18]">
        <div className="text-xs font-semibold text-[#252525] dark:text-[#F4F3EE] tabular-nums">
          Batch Queue: {doneItems.length} / {items.length} converted
          {failedCount > 0 && (
            <span className="text-[#DC2626] dark:text-[#FCA5A5] ml-2">
              · {failedCount} failed
            </span>
          )}
          {doneItems.length > 0 && (
            <span className="text-[#707070] dark:text-[#A6A49C] font-normal ml-2">
              · Total output {(totalOutBytes / 1024).toFixed(1)} KB
            </span>
          )}
        </div>

        {doneItems.length > 0 && (
          <button
            type="button"
            disabled={processing || zipBusy}
            onClick={onDownloadAllZip}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#252525] hover:bg-[#3A3A36] dark:bg-[#F5C542] dark:hover:bg-[#FFD65A] text-white dark:text-[#252525] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {zipBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            <span>Download All ({doneItems.length}) ZIP</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-[#EAEAEA] dark:divide-[#2C2C27]">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              {item.output?.previewUrl ? (
                <img
                  src={item.output.previewUrl}
                  alt={item.output.filename}
                  className="w-9 h-9 rounded border border-[#EAEAEA] dark:border-[#2C2C27] object-cover bg-white shrink-0"
                />
              ) : (
                <FileText className="w-4 h-4 text-[#707070] shrink-0" />
              )}

              <div className="min-w-0">
                <div className="truncate font-medium text-[#252525] dark:text-[#F4F3EE]">
                  {item.file.name}
                </div>
                <div className="text-xs text-[#707070] dark:text-[#A6A49C] tabular-nums flex flex-wrap items-center gap-2">
                  <span>Input {(item.file.size / 1024).toFixed(1)} KB</span>
                  {item.output && (
                    <>
                      <span>→</span>
                      <span className="text-[#252525] dark:text-[#F4F3EE] font-medium">
                        {item.output.filename} ({(item.output.blob.size / 1024).toFixed(1)} KB)
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              {item.status === 'queued' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#707070] whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Queued</span>
                </span>
              )}

              {item.status === 'processing' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D97706] dark:text-[#F5C542] whitespace-nowrap">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing</span>
                </span>
              )}

              {item.status === 'done' && item.output && (
                <>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#16A34A] dark:text-[#4ADE80] whitespace-nowrap tabular-nums">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Ready
                      {typeof item.durationMs === 'number'
                        ? ` · ${(item.durationMs / 1000).toFixed(1)}s`
                        : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDownloadItem(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#2C2C27] bg-white dark:bg-[#1B1B18] hover:border-[#F5C542] text-xs font-semibold text-[#252525] dark:text-[#F4F3EE] cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{item.output.filename.split('.').pop()?.toUpperCase()}</span>
                  </button>
                </>
              )}

              {item.status === 'error' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#DC2626] dark:text-[#FCA5A5] max-w-[220px] truncate">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span title={item.error}>{item.error || 'Failed'}</span>
                </span>
              )}

              {!processing && (
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                  className="p-1.5 rounded-lg text-[#707070] hover:text-[#DC2626] hover:bg-white dark:hover:bg-[#1B1B18] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
