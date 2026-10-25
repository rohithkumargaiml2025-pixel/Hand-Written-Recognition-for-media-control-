import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Eraser,
  PenTool,
  RotateCcw,
  Sparkles,
  Zap,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DigitRecognizer, Stroke, StrokePoint } from '../services/digitRecognizer';
import { RecognitionResult } from '../types/media';

interface DrawingPadProps {
  onDigitRecognized: (result: RecognitionResult) => void;
  confidenceThreshold: number;
  autoDetectEnabled: boolean;
  onToggleAutoDetect: (val: boolean) => void;
  className?: string;
}

export const DrawingPad: React.FC<DrawingPadProps> = ({
  onDigitRecognized,
  confidenceThreshold,
  autoDetectEnabled,
  onToggleAutoDetect,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState(16);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<StrokePoint[]>([]);
  const autoDetectTimerRef = useRef<number | null>(null);
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [latestResult, setLatestResult] = useState<RecognitionResult | null>(null);
  const [showMlInspector, setShowMlInspector] = useState(false);
  const [hasDrawnSomething, setHasDrawnSomething] = useState(false);

  // Redraw canvas from stroke points
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Plain pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw faint guide frame
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Center crosshair
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(cx, 16);
    ctx.lineTo(cx, canvas.height - 16);
    ctx.moveTo(16, cy);
    ctx.lineTo(canvas.width - 16, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw all strokes
    strokes.forEach((stroke) => {
      if (stroke.length < 2) {
        if (stroke.length === 1) {
          ctx.beginPath();
          ctx.arc(stroke[0].x, stroke[0].y, brushSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
        }
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = '#0f172a';

      for (let i = 1; i < stroke.length - 1; i++) {
        const xc = (stroke[i].x + stroke[i + 1].x) / 2;
        const yc = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
      }
      const last = stroke[stroke.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    });

    // Draw current active stroke
    const cur = currentStrokeRef.current;
    if (cur.length > 0) {
      ctx.beginPath();
      ctx.moveTo(cur[0].x, cur[0].y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = '#0f172a';

      for (let i = 1; i < cur.length - 1; i++) {
        const xc = (cur[i].x + cur[i + 1].x) / 2;
        const yc = (cur[i].y + cur[i + 1].y) / 2;
        ctx.quadraticCurveTo(cur[i].x, cur[i].y, xc, yc);
      }
      if (cur.length > 1) {
        const last = cur[cur.length - 1];
        ctx.lineTo(last.x, last.y);
      }
      ctx.stroke();
    }
  }, [strokes, brushSize]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Run recognition
  const executeRecognition = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const result = DigitRecognizer.recognize(canvas, strokes);
    if (result) {
      setLatestResult(result);
      if (result.confidence >= confidenceThreshold) {
        onDigitRecognized(result);
      }
    }
    setCountdownProgress(0);
  }, [strokes, confidenceThreshold, onDigitRecognized]);

  // Handle pointer down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    setIsDrawing(true);
    setHasDrawnSomething(true);
    currentStrokeRef.current = [{ x, y, time: Date.now() }];

    if (autoDetectTimerRef.current) {
      window.clearInterval(autoDetectTimerRef.current);
      autoDetectTimerRef.current = null;
    }
    setCountdownProgress(0);
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    currentStrokeRef.current.push({ x, y, time: Date.now() });
    redrawCanvas();
  };

  // Handle pointer up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (currentStrokeRef.current.length > 0) {
      const newStrokes = [...strokes, [...currentStrokeRef.current]];
      setStrokes(newStrokes);
      currentStrokeRef.current = [];

      // Auto-detect timer with countdown
      if (autoDetectEnabled) {
        let startTime = Date.now();
        const duration = 500; // 500ms auto detect debounce

        if (autoDetectTimerRef.current) {
          window.clearInterval(autoDetectTimerRef.current);
        }

        autoDetectTimerRef.current = window.setInterval(() => {
          const elapsed = Date.now() - startTime;
          const prog = Math.min(100, (elapsed / duration) * 100);
          setCountdownProgress(prog);

          if (elapsed >= duration) {
            if (autoDetectTimerRef.current) {
              window.clearInterval(autoDetectTimerRef.current);
              autoDetectTimerRef.current = null;
            }
            executeRecognition();
          }
        }, 30);
      }
    }
  };

  // Clear canvas
  const handleClear = () => {
    if (autoDetectTimerRef.current) {
      window.clearInterval(autoDetectTimerRef.current);
      autoDetectTimerRef.current = null;
    }
    setStrokes([]);
    currentStrokeRef.current = [];
    setLatestResult(null);
    setCountdownProgress(0);
    setHasDrawnSomething(false);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // Undo last stroke
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    if (newStrokes.length === 0) {
      handleClear();
    }
  };

  return (
    <div className={`flex flex-col bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs ${className}`}>
      {/* Canvas Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-900" />
          <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
            Handwriting Gesture Pad
          </h2>
          <span className="text-xs text-neutral-400 font-normal">
            Draw digits 0–9
          </span>
        </div>

        {/* Toolbar Tools */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool('pen')}
            className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
              tool === 'pen'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Pen tool"
          >
            <PenTool className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-md text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
            title="Undo stroke"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={!hasDrawnSomething && strokes.length === 0}
            className="px-2.5 py-1 rounded-md text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 disabled:opacity-40 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Drawing Surface */}
      <div className="relative w-full aspect-square max-h-[340px] bg-white flex items-center justify-center p-3 select-none touch-none">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full max-w-[320px] max-h-[320px] bg-white border border-neutral-300 rounded-lg shadow-inner cursor-crosshair touch-none"
        />

        {/* Empty helper hint */}
        {!hasDrawnSomething && strokes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
            <span className="text-4xl font-light text-neutral-200 select-none">
              1
            </span>
            <p className="text-xs font-medium text-neutral-500 mt-2">
              Draw any digit here to trigger its media command
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              e.g. 1 for Play/Pause · 5 for Volume Up · 0 for Mute
            </p>
          </div>
        )}

        {/* Auto-detect countdown ring */}
        {countdownProgress > 0 && (
          <div className="absolute top-5 right-5 pointer-events-none flex items-center gap-1.5 px-2 py-1 bg-white/95 border border-neutral-200 rounded-md shadow-xs text-xs font-mono">
            <div className="w-3 h-3 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
            <span className="text-[11px] text-neutral-700">Detecting...</span>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="px-4 py-3 bg-neutral-50/70 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Auto-detect Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoDetectEnabled}
              onChange={(e) => onToggleAutoDetect(e.target.checked)}
              className="w-4 h-4 rounded text-neutral-900 border-neutral-300 focus:ring-neutral-900"
            />
            <span className="text-xs font-medium text-neutral-700">
              Auto-Recognize (500ms)
            </span>
          </label>

          {/* Stroke Thickness */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-600">
            <span>Ink:</span>
            <input
              type="range"
              min={8}
              max={28}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-16 h-1.5 accent-neutral-900 cursor-pointer"
            />
          </div>
        </div>

        {/* Manual Trigger & Inspector Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMlInspector(!showMlInspector)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-medium text-neutral-700 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-neutral-500" />
            <span>Neural View</span>
            {showMlInspector ? (
              <ChevronUp className="w-3 h-3 text-neutral-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            )}
          </button>

          <button
            type="button"
            onClick={executeRecognition}
            disabled={strokes.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recognize & Run</span>
          </button>
        </div>
      </div>

      {/* Machine Learning Inspector Section (Collapsible) */}
      {showMlInspector && (
        <div className="p-4 border-t border-neutral-200 bg-white animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
            <span className="text-xs font-semibold text-neutral-900">
              MNIST Preprocessor & Neural Probabilities
            </span>
            {latestResult && (
              <span className="text-xs font-mono text-neutral-600">
                Top: <strong className="text-neutral-900 font-semibold">{latestResult.digit}</strong> ({Math.round(latestResult.confidence * 100)}%)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 28x28 Normalized Bitmap Preview */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-neutral-500 font-medium">
                Standardized 28×28 Tensor Grid (Center of Mass)
              </span>
              <div className="flex items-center gap-3">
                <div className="relative w-28 h-28 bg-white border border-neutral-300 rounded p-1 flex items-center justify-center">
                  {latestResult ? (
                    <div className="grid grid-cols-28 gap-0 w-full h-full">
                      {latestResult.tensor28x28.flatMap((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className="w-[3px] h-[3px]"
                            style={{
                              backgroundColor: `rgb(${255 - Math.round(val * 240)}, ${255 - Math.round(val * 240)}, ${255 - Math.round(val * 240)})`,
                            }}
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-neutral-400 text-center">
                      Draw a digit to inspect 28×28 tensor
                    </div>
                  )}
                </div>

                <div className="text-xs text-neutral-600 space-y-1">
                  <div>
                    Dimensions: <span className="font-mono text-neutral-900">28 × 28</span>
                  </div>
                  <div>
                    Strokes:{' '}
                    <span className="font-mono text-neutral-900">{strokes.length}</span>
                  </div>
                  {latestResult && (
                    <>
                      <div>
                        Center of Mass:{' '}
                        <span className="font-mono text-neutral-900">
                          ({latestResult.centerOfMass.x.toFixed(1)},{' '}
                          {latestResult.centerOfMass.y.toFixed(1)})
                        </span>
                      </div>
                      <div>
                        Threshold:{' '}
                        <span className="font-mono text-neutral-900">
                          {Math.round(confidenceThreshold * 100)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Probability Bars (0 to 9) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-neutral-500 font-medium">
                Softmax Class Probabilities (0–9)
              </span>
              <div className="space-y-1">
                {Array.from({ length: 10 }).map((_, d) => {
                  const prob = latestResult?.probabilities[d] || 0;
                  const isTop = latestResult?.digit === d;
                  return (
                    <div key={d} className="flex items-center gap-2 text-xs">
                      <span
                        className={`w-4 font-mono font-medium text-right ${
                          isTop ? 'text-neutral-900 font-bold' : 'text-neutral-500'
                        }`}
                      >
                        {d}
                      </span>
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-200 rounded-full ${
                            isTop ? 'bg-neutral-900' : 'bg-neutral-300'
                          }`}
                          style={{ width: `${Math.round(prob * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-[11px] font-mono text-right text-neutral-500">
                        {Math.round(prob * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
