import React from 'react';
import { Volume2, Play } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onQuickDemo: () => void;
  isPlaying: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onQuickDemo,
  isPlaying,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Wordmark */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onTabChange('studio');
          }}
          className="text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span>DigitTempo</span>
        </a>

        {/* Zone 2: 4-5 Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          <button
            type="button"
            onClick={() => onTabChange('studio')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'studio'
                ? 'text-neutral-900 font-semibold'
                : 'hover:text-neutral-900'
            }`}
          >
            Studio
          </button>
          <button
            type="button"
            onClick={() => onTabChange('bindings')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'bindings'
                ? 'text-neutral-900 font-semibold'
                : 'hover:text-neutral-900'
            }`}
          >
            Mappings
          </button>
          <button
            type="button"
            onClick={() => onTabChange('guide')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'text-neutral-900 font-semibold'
                : 'hover:text-neutral-900'
            }`}
          >
            Guide
          </button>
          <button
            type="button"
            onClick={() => onTabChange('history')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'text-neutral-900 font-semibold'
                : 'hover:text-neutral-900'
            }`}
          >
            Activity
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onQuickDemo}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 shadow-xs active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{isPlaying ? 'Pause Demo' : 'Play Demo'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
