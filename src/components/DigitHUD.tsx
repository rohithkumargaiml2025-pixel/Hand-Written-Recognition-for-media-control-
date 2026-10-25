import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { RecognitionResult } from '../types/media';
import { MEDIA_ACTIONS } from '../constants/actions';

interface DigitHUDProps {
  latestResult: RecognitionResult | null;
  actionLabel?: string;
}

export const DigitHUD: React.FC<DigitHUDProps> = ({ latestResult, actionLabel }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!latestResult) return;
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
    }, 2400);

    return () => clearTimeout(timer);
  }, [latestResult]);

  if (!visible || !latestResult) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none transition-all duration-300 transform translate-y-0 opacity-100">
      <div className="bg-white border-2 border-neutral-900 shadow-xl rounded-xl p-3.5 flex items-center gap-3.5 max-w-sm pointer-events-auto animate-in slide-in-from-bottom-4 duration-200">
        {/* Large Digit Icon */}
        <div className="w-12 h-12 bg-neutral-900 text-white rounded-lg flex items-center justify-center font-mono font-bold text-2xl shadow-inner shrink-0">
          {latestResult.digit}
        </div>

        {/* Text information */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Recognized with {Math.round(latestResult.confidence * 100)}% confidence</span>
          </div>

          <div className="text-sm font-bold text-neutral-900 truncate mt-0.5">
            {actionLabel || 'Command Triggered'}
          </div>

          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
            Latency &lt; 15ms · Neural MNIST
          </div>
        </div>
      </div>
    </div>
  );
};
