export type MediaActionId =
  | 'toggle_play_pause'
  | 'next_track'
  | 'prev_track'
  | 'volume_up'
  | 'volume_down'
  | 'toggle_mute'
  | 'seek_forward'
  | 'seek_backward'
  | 'cycle_playback_speed'
  | 'cycle_visualizer'
  | 'toggle_loop'
  | 'toggle_shuffle'
  | 'toggle_bass_boost';

export interface MediaActionDefinition {
  id: MediaActionId;
  label: string;
  description: string;
  icon: string;
  category: 'playback' | 'volume' | 'navigation' | 'audio_fx';
}

export interface DigitBinding {
  digit: number;
  actionId: MediaActionId;
}

export type VisualizerMode = 'bars' | 'wave' | 'radial' | 'particles';
export type LoopMode = 'off' | 'one' | 'all';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // in seconds
  coverArt: string;
  bpm: number;
  synthTheme: 'lofi' | 'synthwave' | 'acoustic' | 'deeptech';
  description: string;
  audioBuffer?: AudioBuffer;
  isCustom?: boolean;
}

export interface RecognitionResult {
  digit: number;
  confidence: number;
  probabilities: number[];
  boundingBox: { x: number; y: number; width: number; height: number };
  centerOfMass: { x: number; y: number };
  tensor28x28: number[][];
  timestamp: number;
  source: 'neural_engine' | 'ai_vision';
}

export interface ActivityLogItem {
  id: string;
  timestamp: number;
  digit: number;
  actionId: MediaActionId;
  actionLabel: string;
  confidence: number;
  success: boolean;
}
