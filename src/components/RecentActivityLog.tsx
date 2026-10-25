import React from 'react';
import { History, Trash2, CheckCircle2 } from 'lucide-react';
import { ActivityLogItem } from '../types/media';

interface RecentActivityLogProps {
  logs: ActivityLogItem[];
  onClearLogs: () => void;
  className?: string;
}

export const RecentActivityLog: React.FC<RecentActivityLogProps> = ({
  logs,
  onClearLogs,
  className = '',
}) => {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className={`bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-neutral-800" />
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Gesture Execution Log
          </h2>
        </div>

        {logs.length > 0 && (
          <button
            type="button"
            onClick={onClearLogs}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 bg-white">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400">
            No digits recognized yet. Draw on the canvas or click "Test Run" to trigger actions.
          </div>
        ) : (
          logs.map((item) => (
            <div
              key={item.id}
              className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-neutral-50/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-neutral-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {item.digit}
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-900">
                    {item.actionLabel}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Confidence: {Math.round(item.confidence * 100)}%
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-neutral-400 tabular-nums">
                  {formatTime(item.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
