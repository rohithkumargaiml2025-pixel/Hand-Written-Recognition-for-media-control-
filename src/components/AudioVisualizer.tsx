import React, { useEffect, useRef } from 'react';
import { VisualizerMode } from '../types/media';
import { AudioEngine } from '../services/audioEngine';

interface AudioVisualizerProps {
  mode: VisualizerMode;
  isPlaying: boolean;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  mode,
  isPlaying,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const engine = AudioEngine.getInstance();
    const analyser = engine.getAnalyser();

    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    // Particle state for 'particles' mode
    const particles = Array.from({ length: 48 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      radius: Math.random() * 2 + 1,
      baseRadius: Math.random() * 2 + 1,
    }));

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // Plain crisp white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);
      } else {
        // Subtle resting idle sine wave
        const now = Date.now() / 800;
        for (let i = 0; i < bufferLength; i++) {
          freqData[i] = Math.max(0, Math.sin(now + i * 0.1) * 20);
          timeData[i] = 128 + Math.sin(now + i * 0.08) * 8;
        }
      }

      switch (mode) {
        case 'bars': {
          const barCount = 42;
          const barWidth = (width / barCount) * 0.65;
          const gap = (width / barCount) * 0.35;
          const step = Math.floor(bufferLength / barCount);

          for (let i = 0; i < barCount; i++) {
            const val = freqData[i * step] || 0;
            const percent = val / 255;
            const barHeight = Math.max(4, percent * (height - 24));
            const x = i * (barWidth + gap) + gap / 2;
            const y = height - barHeight - 4;

            // Clean monochromatic charcoal-to-indigo gradient on pure white
            const grad = ctx.createLinearGradient(0, y, 0, height);
            grad.addColorStop(0, '#0f172a');
            grad.addColorStop(1, '#64748b');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
            ctx.fill();
          }
          break;
        }

        case 'wave': {
          ctx.beginPath();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#0f172a';

          const sliceWidth = width / (bufferLength - 1);
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.stroke();

          // Subtle shadow reflection
          ctx.lineWidth = 1.0;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
          ctx.stroke();
          break;
        }

        case 'radial': {
          const cx = width / 2;
          const cy = height / 2;
          const baseRadius = Math.min(width, height) * 0.22;
          const spokes = 48;
          const step = Math.floor(bufferLength / spokes);

          // Center anchor circle
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          for (let i = 0; i < spokes; i++) {
            const angle = (i / spokes) * Math.PI * 2;
            const val = freqData[i * step] || 0;
            const len = (val / 255) * (Math.min(width, height) * 0.24);

            const x1 = cx + Math.cos(angle) * baseRadius;
            const y1 = cy + Math.sin(angle) * baseRadius;
            const x2 = cx + Math.cos(angle) * (baseRadius + len);
            const y2 = cy + Math.sin(angle) * (baseRadius + len);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
          break;
        }

        case 'particles': {
          let energy = 0;
          for (let i = 0; i < 32; i++) energy += freqData[i];
          const avgEnergy = energy / 32 / 255;

          particles.forEach((p, idx) => {
            p.x += p.vx * (1 + avgEnergy * 2);
            p.y += p.vy * (1 + avgEnergy * 2);

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            p.radius = p.baseRadius + avgEnergy * 4;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();

            // Connect nearby particles
            for (let j = idx + 1; j < particles.length; j++) {
              const p2 = particles[j];
              const dx = p.x - p2.x;
              const dy = p.y - p2.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 55) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = `rgba(15, 23, 42, ${0.25 * (1 - dist / 55)})`;
                ctx.lineWidth = 0.75;
                ctx.stroke();
              }
            }
          });
          break;
        }
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mode, isPlaying]);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-white ${className}`}>
      <canvas
        ref={canvasRef}
        width={420}
        height={110}
        className="w-full h-full block bg-white"
      />
    </div>
  );
};
