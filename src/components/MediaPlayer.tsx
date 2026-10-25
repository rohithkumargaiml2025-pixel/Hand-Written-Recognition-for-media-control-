import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Repeat1,
  Shuffle,
  Sliders,
  Music,
  FolderOpen,
  Activity,
  Layers,
} from 'lucide-react';
import { Track, VisualizerMode, LoopMode } from '../types/media';
import { AudioVisualizer } from './AudioVisualizer';
import { AudioEngine } from '../services/audioEngine';

interface MediaPlayerProps {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  visualizerMode: VisualizerMode;
  loopMode: LoopMode;
  isShuffle: boolean;
  onTogglePlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onVisualizerModeChange: (mode: VisualizerMode) => void;
  onToggleLoop: () => void;
  onToggleShuffle: () => void;
  onSelectTrack: (index: number) => void;
  onUploadCustomTrack: (file: File) => void;
  className?: string;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  currentTime,
  volume,
  isMuted,
  playbackRate,
  visualizerMode,
  loopMode,
  isShuffle,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onVisualizerModeChange,
  onToggleLoop,
  onToggleShuffle,
  onSelectTrack,
  onUploadCustomTrack,
  className = '',
}) => {
  const currentTrack = tracks[currentTrackIndex] || tracks[0];
  const [showEq, setShowEq] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [eqGains, setEqGains] = useState<number[]>([0, 0, 0, 0, 0]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = pos * currentTrack.duration;
    onSeek(targetTime);
  };

  const handleEqChange = (bandIndex: 0 | 1 | 2 | 3 | 4, value: number) => {
    const newGains = [...eqGains];
    newGains[bandIndex] = value;
    setEqGains(newGains);
    AudioEngine.getInstance().setEqGain(bandIndex, value);
  };

  const applyEqPreset = (preset: 'flat' | 'bass' | 'warmth' | 'vocal' | 'punch') => {
    let gains = [0, 0, 0, 0, 0];
    if (preset === 'bass') gains = [8, 4, 0, -1, -2];
    if (preset === 'warmth') gains = [3, 5, 2, 0, -1];
    if (preset === 'vocal') gains = [-2, 0, 6, 4, 1];
    if (preset === 'punch') gains = [7, 2, -2, 4, 6];

    setEqGains(gains);
    gains.forEach((g, i) => {
      AudioEngine.getInstance().setEqGain(i as 0 | 1 | 2 | 3 | 4, g);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadCustomTrack(file);
    }
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, (currentTime / (currentTrack.duration || 1)) * 100)
  );

  return (
    <div
      className={`bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs flex flex-col ${className}`}
    >
      {/* Player Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Media Playback Deck
          </h2>
          <span className="text-xs text-neutral-400 font-normal">
            Track {currentTrackIndex + 1} of {tracks.length}
          </span>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
              showPlaylist
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Playlist</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEq(!showEq)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
              showEq
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Equalizer</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
            title="Import custom audio file"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* Main Track Presentation */}
      <div className="p-5 flex flex-col md:flex-row gap-5 items-stretch bg-white">
        {/* Album Cover */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0 mx-auto md:mx-0 rounded-lg overflow-hidden border border-neutral-200 shadow-xs bg-neutral-100 group">
          <img
            src={currentTrack.coverArt}
            alt={currentTrack.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {isPlaying && (
            <div className="absolute top-2 right-2 bg-neutral-900/90 text-white text-[10px] font-medium px-2 py-0.5 rounded backdrop-blur-sm">
              Playing
            </div>
          )}
        </div>

        {/* Track Info & Visualizer Container */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-bold tracking-tight text-neutral-900 truncate">
                {currentTrack.title}
              </h3>
              <span className="text-xs font-mono text-neutral-500 shrink-0">
                {currentTrack.bpm} BPM
              </span>
            </div>

            {/* Zero-Pill Clean Metadata */}
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
              <span className="font-medium text-neutral-700">{currentTrack.artist}</span>
              <span aria-hidden="true">·</span>
              <span>{currentTrack.album}</span>
              <span aria-hidden="true">·</span>
              <span>{currentTrack.genre}</span>
            </div>

            <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
              {currentTrack.description}
            </p>
          </div>

          {/* Real-time Visualizer Canvas */}
          <div className="mt-4 border border-neutral-200 rounded-lg overflow-hidden bg-white">
            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50/70 border-b border-neutral-200 text-[11px] text-neutral-600">
              <span className="font-medium flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-neutral-700" />
                Live Spectrum Visualizer
              </span>
              <div className="flex items-center gap-1">
                {(['bars', 'wave', 'radial', 'particles'] as VisualizerMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onVisualizerModeChange(m)}
                    className={`px-1.5 py-0.5 rounded text-[10px] capitalize transition-colors ${
                      visualizerMode === m
                        ? 'bg-neutral-900 text-white font-medium'
                        : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <AudioVisualizer mode={visualizerMode} isPlaying={isPlaying} />
          </div>
        </div>
      </div>

      {/* Scrubber Progress Bar */}
      <div className="px-5 pt-2 pb-1 bg-white">
        <div
          onClick={handleProgressBarClick}
          className="relative w-full h-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-full cursor-pointer transition-colors group"
        >
          <div
            className="h-full bg-neutral-900 rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-neutral-900 border-2 border-white rounded-full shadow-xs opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Timestamps in tabular figures */}
        <div className="flex justify-between items-center text-[11px] font-mono text-neutral-500 mt-1 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(currentTrack.duration)}</span>
        </div>
      </div>

      {/* Control Buttons Strip */}
      <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-4">
        {/* Left Secondary Controls: Shuffle, Loop */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              isShuffle
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
            title={`Shuffle mode: ${isShuffle ? 'On' : 'Off'} (Gesture digit: 8)`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              loopMode !== 'off'
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
            }`}
            title={`Loop mode: ${loopMode} (Gesture digit: 7)`}
          >
            {loopMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Center Primary Playback Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Previous Track */}
          <button
            type="button"
            onClick={onPrevTrack}
            className="p-2 sm:p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors"
            title="Previous track (Gesture digit: 3)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Seek -15s */}
          <button
            type="button"
            onClick={() => onSeek(currentTime - 15)}
            className="p-2 sm:p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 transition-colors"
            title="Seek backward 15s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Primary Play/Pause Button */}
          <button
            type="button"
            onClick={onTogglePlayPause}
            className="w-12 h-12 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white flex items-center justify-center shadow-sm transition-transform active:scale-95"
            title="Play / Pause (Gesture digit: 1)"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          {/* Seek +15s */}
          <button
            type="button"
            onClick={() => onSeek(currentTime + 15)}
            className="p-2 sm:p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 transition-colors"
            title="Seek forward 15s"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNextTrack}
            className="p-2 sm:p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors"
            title="Next track (Gesture digit: 2)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls: Playback Speed & Volume Slider */}
        <div className="flex items-center gap-3">
          {/* Playback speed selector */}
          <button
            type="button"
            onClick={() => {
              const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
              const curIdx = rates.indexOf(playbackRate);
              const nextRate = rates[(curIdx + 1) % rates.length];
              onPlaybackRateChange(nextRate);
            }}
            className="px-2 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-mono font-medium text-neutral-700 transition-colors"
            title="Cycle speed (Gesture digit: 6)"
          >
            {playbackRate}x
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1.5 rounded-md text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Mute / Unmute (Gesture digit: 0)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 h-1.5 accent-neutral-900 cursor-pointer"
              title="Volume (Gesture digits: 4 to lower, 5 to raise)"
            />
          </div>
        </div>
      </div>

      {/* Playlist Drawer (Collapsible) */}
      {showPlaylist && (
        <div className="p-4 border-t border-neutral-200 bg-white animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-neutral-900">
              Track Queue ({tracks.length} Songs)
            </span>
            <span className="text-xs text-neutral-500">
              Select or draw digit to navigate
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tracks.map((t, idx) => {
              const active = idx === currentTrackIndex;
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTrack(idx)}
                  className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                    active
                      ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
                  }`}
                >
                  <img
                    src={t.coverArt}
                    alt={t.title}
                    className="w-10 h-10 rounded object-cover border border-neutral-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-neutral-900 truncate">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {t.artist} · {t.genre}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 tabular-nums">
                    {formatTime(t.duration)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5-Band Equalizer Drawer (Collapsible) */}
      {showEq && (
        <div className="p-4 border-t border-neutral-200 bg-white animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <span className="text-xs font-semibold text-neutral-900 block">
                5-Band Master Graphic Equalizer
              </span>
              <span className="text-[11px] text-neutral-500">
                Hardware-accurate Biquad audio filters
              </span>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'flat', label: 'Flat' },
                  { id: 'bass', label: 'Bass Boost' },
                  { id: 'warmth', label: 'Warmth' },
                  { id: 'vocal', label: 'Vocal' },
                  { id: 'punch', label: 'Punch' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyEqPreset(p.id)}
                  className="px-2 py-1 rounded text-xs border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 pt-2 text-center">
            {[
              { label: 'Sub Bass', freq: '60 Hz', band: 0 },
              { label: 'Low Mid', freq: '250 Hz', band: 1 },
              { label: 'Mid', freq: '1 kHz', band: 2 },
              { label: 'High Mid', freq: '4 kHz', band: 3 },
              { label: 'Treble', freq: '12 kHz', band: 4 },
            ].map(({ label, freq, band }) => (
              <div key={freq} className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-mono text-neutral-900 tabular-nums">
                  {eqGains[band] > 0 ? `+${eqGains[band]}` : eqGains[band]} dB
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={eqGains[band]}
                  onChange={(e) =>
                    handleEqChange(band as 0 | 1 | 2 | 3 | 4, parseFloat(e.target.value))
                  }
                  className="h-28 w-1.5 accent-neutral-900 cursor-pointer -rotate-180 [writing-mode:vertical-lr]"
                />
                <div>
                  <div className="text-[11px] font-medium text-neutral-800">{label}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">{freq}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
