import React from 'react';
import {
  Play,
  SkipForward,
  SkipBack,
  Volume2,
  Volume1,
  VolumeX,
  FastForward,
  Rewind,
  Gauge,
  Activity,
  Repeat,
  Shuffle,
  Sliders,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DigitBinding, MediaActionId } from '../types/media';
import {
  MEDIA_ACTIONS,
  DEFAULT_DIGIT_BINDINGS,
  PRESET_BINDING_PROFILES,
} from '../constants/actions';

interface BindingManagerProps {
  bindings: DigitBinding[];
  onUpdateBinding: (digit: number, actionId: MediaActionId) => void;
  onApplyPreset: (bindings: DigitBinding[]) => void;
  onSimulateDigit: (digit: number) => void;
  className?: string;
}

export const BindingManager: React.FC<BindingManagerProps> = ({
  bindings,
  onUpdateBinding,
  onApplyPreset,
  onSimulateDigit,
  className = '',
}) => {
  const getActionIcon = (actionId: MediaActionId) => {
    switch (actionId) {
      case 'toggle_play_pause':
        return <Play className="w-4 h-4 text-neutral-900" />;
      case 'next_track':
        return <SkipForward className="w-4 h-4 text-neutral-900" />;
      case 'prev_track':
        return <SkipBack className="w-4 h-4 text-neutral-900" />;
      case 'volume_up':
        return <Volume2 className="w-4 h-4 text-neutral-900" />;
      case 'volume_down':
        return <Volume1 className="w-4 h-4 text-neutral-900" />;
      case 'toggle_mute':
        return <VolumeX className="w-4 h-4 text-neutral-900" />;
      case 'seek_forward':
        return <FastForward className="w-4 h-4 text-neutral-900" />;
      case 'seek_backward':
        return <Rewind className="w-4 h-4 text-neutral-900" />;
      case 'cycle_playback_speed':
        return <Gauge className="w-4 h-4 text-neutral-900" />;
      case 'cycle_visualizer':
        return <Activity className="w-4 h-4 text-neutral-900" />;
      case 'toggle_loop':
        return <Repeat className="w-4 h-4 text-neutral-900" />;
      case 'toggle_shuffle':
        return <Shuffle className="w-4 h-4 text-neutral-900" />;
      case 'toggle_bass_boost':
        return <Sliders className="w-4 h-4 text-neutral-900" />;
      default:
        return <Sparkles className="w-4 h-4 text-neutral-900" />;
    }
  };

  return (
    <div
      className={`bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-white gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Digit-to-Action Mapping Matrix
          </h2>
          <p className="text-xs text-neutral-500">
            Configure custom media actions for handwritten digits 0 through 9
          </p>
        </div>

        {/* Profile Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400 mr-1 hidden sm:inline">
            Presets:
          </span>
          {PRESET_BINDING_PROFILES.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onApplyPreset(preset.bindings)}
              className="px-2.5 py-1 text-xs rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
            >
              {preset.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onApplyPreset(DEFAULT_DIGIT_BINDINGS)}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title="Reset to default bindings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid of 10 Digits */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white">
        {bindings.map((b) => {
          const actionDef = MEDIA_ACTIONS[b.actionId];
          return (
            <div
              key={b.digit}
              className="p-3.5 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                {/* Digit Icon Badge */}
                <div className="w-9 h-9 rounded-md bg-neutral-100 border border-neutral-200 flex items-center justify-center font-mono font-bold text-lg text-neutral-900 shrink-0">
                  {b.digit}
                </div>

                {/* Quick Simulate Trigger */}
                <button
                  type="button"
                  onClick={() => onSimulateDigit(b.digit)}
                  className="px-2 py-1 rounded text-[10px] font-medium border border-neutral-200 bg-white hover:bg-neutral-900 hover:text-white text-neutral-600 transition-colors"
                  title={`Simulate drawing digit ${b.digit}`}
                >
                  Test Run
                </button>
              </div>

              {/* Action Selector */}
              <div className="mt-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 mb-1 truncate">
                  {getActionIcon(b.actionId)}
                  <span className="truncate">{actionDef?.label}</span>
                </div>

                <select
                  value={b.actionId}
                  onChange={(e) =>
                    onUpdateBinding(b.digit, e.target.value as MediaActionId)
                  }
                  className="w-full text-xs py-1 px-1.5 rounded border border-neutral-200 bg-white text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                >
                  {Object.values(MEDIA_ACTIONS).map((action) => (
                    <option key={action.id} value={action.id}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[10px] text-neutral-400 mt-2 truncate">
                {actionDef?.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
