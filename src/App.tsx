import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { DrawingPad } from './components/DrawingPad';
import { MediaPlayer } from './components/MediaPlayer';
import { BindingManager } from './components/BindingManager';
import { PracticeGuide } from './components/PracticeGuide';
import { RecentActivityLog } from './components/RecentActivityLog';
import { DigitHUD } from './components/DigitHUD';
import {
  Track,
  DigitBinding,
  MediaActionId,
  VisualizerMode,
  LoopMode,
  RecognitionResult,
  ActivityLogItem,
} from './types/media';
import {
  BUILTIN_TRACKS,
  DEFAULT_DIGIT_BINDINGS,
  MEDIA_ACTIONS,
} from './constants/actions';
import { AudioEngine } from './services/audioEngine';
import { HelpCircle, Sparkles, Volume2, Music, CheckCircle } from 'lucide-react';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState('studio');

  // Media Player State
  const [tracks, setTracks] = useState<Track[]>(BUILTIN_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [isBassBoosted, setIsBassBoosted] = useState(false);

  // Recognition & Gestures State
  const [bindings, setBindings] = useState<DigitBinding[]>(DEFAULT_DIGIT_BINDINGS);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.42);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [latestRecognition, setLatestRecognition] = useState<RecognitionResult | null>(null);
  const [latestActionLabel, setLatestActionLabel] = useState<string>('');
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);

  const audioEngine = useRef(AudioEngine.getInstance()).current;

  // Sync AudioEngine time updates
  useEffect(() => {
    audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    audioEngine.onTrackEnded(() => {
      handleTrackEnd();
    });
  }, [tracks, currentTrackIndex, loopMode, isShuffle]);

  const handleTrackEnd = () => {
    if (loopMode === 'one') {
      audioEngine.playTrack(tracks[currentTrackIndex], 0);
    } else if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(nextIdx);
      audioEngine.playTrack(tracks[nextIdx], 0);
    } else if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex((prev) => prev + 1);
      audioEngine.playTrack(tracks[currentTrackIndex + 1], 0);
    } else if (loopMode === 'all') {
      setCurrentTrackIndex(0);
      audioEngine.playTrack(tracks[0], 0);
    } else {
      setIsPlaying(false);
      audioEngine.pause();
    }
  };

  // Execute Media Action
  const executeAction = useCallback(
    (actionId: MediaActionId) => {
      switch (actionId) {
        case 'toggle_play_pause': {
          if (isPlaying) {
            audioEngine.pause();
            setIsPlaying(false);
          } else {
            audioEngine.playTrack(tracks[currentTrackIndex], currentTime);
            setIsPlaying(true);
          }
          break;
        }

        case 'next_track': {
          let nextIdx = (currentTrackIndex + 1) % tracks.length;
          if (isShuffle) {
            nextIdx = Math.floor(Math.random() * tracks.length);
          }
          setCurrentTrackIndex(nextIdx);
          setCurrentTime(0);
          audioEngine.playTrack(tracks[nextIdx], 0);
          setIsPlaying(true);
          break;
        }

        case 'prev_track': {
          if (currentTime > 4) {
            audioEngine.seek(0);
            setCurrentTime(0);
          } else {
            const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            setCurrentTrackIndex(prevIdx);
            setCurrentTime(0);
            audioEngine.playTrack(tracks[prevIdx], 0);
            setIsPlaying(true);
          }
          break;
        }

        case 'volume_up': {
          const newVol = Math.min(1.0, Math.round((volume + 0.1) * 10) / 10);
          setVolume(newVol);
          audioEngine.setVolume(newVol);
          if (isMuted) {
            setIsMuted(false);
            audioEngine.setMute(false);
          }
          break;
        }

        case 'volume_down': {
          const newVol = Math.max(0.0, Math.round((volume - 0.1) * 10) / 10);
          setVolume(newVol);
          audioEngine.setVolume(newVol);
          break;
        }

        case 'toggle_mute': {
          const nextMute = !isMuted;
          setIsMuted(nextMute);
          audioEngine.setMute(nextMute);
          break;
        }

        case 'seek_forward': {
          const nextTime = Math.min(tracks[currentTrackIndex].duration, currentTime + 15);
          setCurrentTime(nextTime);
          audioEngine.seek(nextTime);
          break;
        }

        case 'seek_backward': {
          const nextTime = Math.max(0, currentTime - 15);
          setCurrentTime(nextTime);
          audioEngine.seek(nextTime);
          break;
        }

        case 'cycle_playback_speed': {
          const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
          const currIdx = speeds.indexOf(playbackRate);
          const nextSpeed = speeds[(currIdx + 1) % speeds.length];
          setPlaybackRate(nextSpeed);
          audioEngine.setPlaybackRate(nextSpeed);
          break;
        }

        case 'cycle_visualizer': {
          const modes: VisualizerMode[] = ['bars', 'wave', 'radial', 'particles'];
          const currIdx = modes.indexOf(visualizerMode);
          const nextMode = modes[(currIdx + 1) % modes.length];
          setVisualizerMode(nextMode);
          break;
        }

        case 'toggle_loop': {
          const modes: LoopMode[] = ['off', 'one', 'all'];
          const currIdx = modes.indexOf(loopMode);
          const nextLoop = modes[(currIdx + 1) % modes.length];
          setLoopMode(nextLoop);
          break;
        }

        case 'toggle_shuffle': {
          setIsShuffle((prev) => !prev);
          break;
        }

        case 'toggle_bass_boost': {
          const nextBoost = !isBassBoosted;
          setIsBassBoosted(nextBoost);
          audioEngine.applyBassBoost(nextBoost);
          break;
        }
      }
    },
    [
      isPlaying,
      currentTrackIndex,
      tracks,
      currentTime,
      volume,
      isMuted,
      playbackRate,
      visualizerMode,
      loopMode,
      isShuffle,
      isBassBoosted,
      audioEngine,
    ]
  );

  // Handle recognized digit
  const handleDigitRecognized = useCallback(
    (result: RecognitionResult) => {
      setLatestRecognition(result);
      audioEngine.playConfirmationChime(result.digit);

      // Find bound action for this digit
      const binding = bindings.find((b) => b.digit === result.digit);
      if (binding) {
        const actionDef = MEDIA_ACTIONS[binding.actionId];
        setLatestActionLabel(actionDef?.label || 'Action Triggered');
        executeAction(binding.actionId);

        // Add to history log
        const logItem: ActivityLogItem = {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          digit: result.digit,
          actionId: binding.actionId,
          actionLabel: actionDef?.label || binding.actionId,
          confidence: result.confidence,
          success: true,
        };
        setActivityLogs((prev) => [logItem, ...prev.slice(0, 30)]);
      }
    },
    [bindings, executeAction, audioEngine]
  );

  // Simulate a digit trigger (from binding grid or guide)
  const handleSimulateDigit = useCallback(
    (digit: number) => {
      const dummyResult: RecognitionResult = {
        digit,
        confidence: 0.99,
        probabilities: Array(10)
          .fill(0)
          .map((_, i) => (i === digit ? 0.99 : 0.001)),
        boundingBox: { x: 50, y: 50, width: 120, height: 180 },
        centerOfMass: { x: 14, y: 14 },
        tensor28x28: Array(28)
          .fill(0)
          .map(() => Array(28).fill(0)),
        timestamp: Date.now(),
        source: 'neural_engine',
      };
      handleDigitRecognized(dummyResult);
    },
    [handleDigitRecognized]
  );

  // Update binding for a digit
  const handleUpdateBinding = (digit: number, actionId: MediaActionId) => {
    setBindings((prev) =>
      prev.map((b) => (b.digit === digit ? { ...b, actionId } : b))
    );
  };

  // Upload custom track
  const handleUploadCustomTrack = async (file: File) => {
    try {
      const custom = await audioEngine.loadAudioFile(file);
      const updated = [custom, ...tracks];
      setTracks(updated);
      setCurrentTrackIndex(0);
      setCurrentTime(0);
      audioEngine.playTrack(custom, 0);
      setIsPlaying(true);
    } catch {
      // Non-fatal fallback
    }
  };

  // Quick Demo Play/Pause
  const handleQuickDemo = () => {
    executeAction('toggle_play_pause');
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white">
      {/* 3-Zone Clean Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickDemo={handleQuickDemo}
        isPlaying={isPlaying}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 bg-white">
        {/* Editorial Sub-bar & Status */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-neutral-100">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Handwritten Digit Media Control
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Instant in-browser neural recognition. Draw digits 0 through 9 to manipulate sound, volume, and playback.
            </p>
          </div>

          {/* Quick Digit Bar (Clickable cheat cards) */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            {bindings.map((b) => (
              <button
                key={b.digit}
                type="button"
                onClick={() => handleSimulateDigit(b.digit)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-200 bg-white hover:bg-neutral-100 hover:border-neutral-300 text-xs transition-colors shrink-0 shadow-2xs"
                title={`Digit ${b.digit}: ${MEDIA_ACTIONS[b.actionId]?.label}`}
              >
                <span className="font-mono font-bold text-neutral-900">{b.digit}</span>
                <span className="text-[11px] text-neutral-500 hidden xl:inline">
                  {MEDIA_ACTIONS[b.actionId]?.label.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Studio (Main 2-Column Desktop Grid) */}
        {activeTab === 'studio' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Drawing Pad & Gestures (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <DrawingPad
                  onDigitRecognized={handleDigitRecognized}
                  confidenceThreshold={confidenceThreshold}
                  autoDetectEnabled={autoDetectEnabled}
                  onToggleAutoDetect={setAutoDetectEnabled}
                />

                {/* Quick Activity History in Studio view */}
                <RecentActivityLog
                  logs={activityLogs.slice(0, 5)}
                  onClearLogs={() => setActivityLogs([])}
                />
              </div>

              {/* Right Column: Media Playback Deck (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <MediaPlayer
                  tracks={tracks}
                  currentTrackIndex={currentTrackIndex}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  volume={volume}
                  isMuted={isMuted}
                  playbackRate={playbackRate}
                  visualizerMode={visualizerMode}
                  loopMode={loopMode}
                  isShuffle={isShuffle}
                  onTogglePlayPause={() => executeAction('toggle_play_pause')}
                  onNextTrack={() => executeAction('next_track')}
                  onPrevTrack={() => executeAction('prev_track')}
                  onSeek={(secs) => {
                    setCurrentTime(secs);
                    audioEngine.seek(secs);
                  }}
                  onVolumeChange={(val) => {
                    setVolume(val);
                    audioEngine.setVolume(val);
                    if (isMuted) {
                      setIsMuted(false);
                      audioEngine.setMute(false);
                    }
                  }}
                  onToggleMute={() => executeAction('toggle_mute')}
                  onPlaybackRateChange={(rate) => {
                    setPlaybackRate(rate);
                    audioEngine.setPlaybackRate(rate);
                  }}
                  onVisualizerModeChange={setVisualizerMode}
                  onToggleLoop={() => executeAction('toggle_loop')}
                  onToggleShuffle={() => executeAction('toggle_shuffle')}
                  onSelectTrack={(idx) => {
                    setCurrentTrackIndex(idx);
                    setCurrentTime(0);
                    audioEngine.playTrack(tracks[idx], 0);
                    setIsPlaying(true);
                  }}
                  onUploadCustomTrack={handleUploadCustomTrack}
                />

                {/* Quick Guide card below player */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-neutral-800" />
                    <span className="text-xs font-semibold text-neutral-900">
                      Standard Digit Commands
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">0</span>
                      <span className="text-neutral-600">Mute/Unmute</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">1</span>
                      <span className="text-neutral-600">Play/Pause</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">2</span>
                      <span className="text-neutral-600">Next Track</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">3</span>
                      <span className="text-neutral-600">Prev Track</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">4</span>
                      <span className="text-neutral-600">Vol Down</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">5</span>
                      <span className="text-neutral-600">Vol Up</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">6</span>
                      <span className="text-neutral-600">Cycle Speed</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">7</span>
                      <span className="text-neutral-600">Loop Mode</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">8</span>
                      <span className="text-neutral-600">Shuffle</span>
                    </div>
                    <div className="p-2 rounded bg-neutral-50 border border-neutral-100">
                      <span className="font-mono font-bold text-neutral-900 mr-1.5">9</span>
                      <span className="text-neutral-600">Visualizer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Digit Mappings */}
        {activeTab === 'bindings' && (
          <BindingManager
            bindings={bindings}
            onUpdateBinding={handleUpdateBinding}
            onApplyPreset={setBindings}
            onSimulateDigit={handleSimulateDigit}
          />
        )}

        {/* Tab 3: Practice Guide & Cheat Sheet */}
        {activeTab === 'guide' && <PracticeGuide />}

        {/* Tab 4: Full Activity History */}
        {activeTab === 'history' && (
          <RecentActivityLog
            logs={activityLogs}
            onClearLogs={() => setActivityLogs([])}
          />
        )}
      </main>

      {/* Floating HUD Feedback Toast */}
      <DigitHUD
        latestResult={latestRecognition}
        actionLabel={latestActionLabel}
      />

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            <span>DigitTempo</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Handwritten Digit Recognition for Media Control</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Plain White Surface</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('bindings')}
              className="hover:text-neutral-900 transition-colors"
            >
              Configure Bindings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className="hover:text-neutral-900 transition-colors"
            >
              Handwriting Guide
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
