import React, { useState } from 'react';
import { HelpCircle, Check, ArrowRight } from 'lucide-react';
import { DigitRecognizer } from '../services/digitRecognizer';

export const PracticeGuide: React.FC = () => {
  const [selectedDigit, setSelectedDigit] = useState(1);

  const digitTips = [
    {
      digit: 0,
      title: 'Digit 0: Closed Oval Loop',
      strokeDesc: 'Start at the top, sweep counter-clockwise in a smooth oval, and seal the top.',
      mnistFeature: 'Identified by large central negative space (empty core) and symmetrical horizontal scan crossings.',
      examplePath: 'M 50 20 C 20 20, 20 80, 50 80 C 80 80, 80 20, 50 20 Z',
    },
    {
      digit: 1,
      title: 'Digit 1: Clean Vertical Stem',
      strokeDesc: 'Draw a single continuous downward stroke from top to bottom.',
      mnistFeature: 'Identified by narrow aspect ratio (< 0.5) and concentrated center column activation.',
      examplePath: 'M 50 18 L 50 82',
    },
    {
      digit: 2,
      title: 'Digit 2: Curved Hook & Flat Base',
      strokeDesc: 'Curve around the top right, descend diagonally to the lower left, and pull a flat line right.',
      mnistFeature: 'Identified by top arch and distinct horizontal baseline activation.',
      examplePath: 'M 30 35 C 30 18, 70 18, 70 38 C 70 55, 30 68, 30 82 L 72 82',
    },
    {
      digit: 3,
      title: 'Digit 3: Double Rightward Arcs',
      strokeDesc: 'Top round bulb curving into center, indenting slightly, then sweeping into the lower bulb.',
      mnistFeature: 'Identified by open left side and strong right-quadrant weight.',
      examplePath: 'M 35 25 C 45 18, 68 18, 68 40 C 68 50, 48 50, 48 50 C 72 50, 72 78, 35 80',
    },
    {
      digit: 4,
      title: 'Digit 4: Down, Across, and Stem',
      strokeDesc: 'Down-left diagonal, horizontal crossbar rightward, finished with vertical right stem.',
      mnistFeature: 'Identified by intersection crossbar and right-side vertical stroke.',
      examplePath: 'M 60 20 L 28 58 L 74 58 M 60 20 L 60 82',
    },
    {
      digit: 5,
      title: 'Digit 5: Top Bar & Rounded Basin',
      strokeDesc: 'Horizontal top bar to the left, vertical drop to mid-line, followed by rounded lower right belly.',
      mnistFeature: 'Identified by top horizontal mass and lower right bulb.',
      examplePath: 'M 68 22 L 34 22 L 32 48 C 36 44, 68 42, 68 64 C 68 82, 36 82, 30 76',
    },
    {
      digit: 6,
      title: 'Digit 6: Downward Arch & Bottom Loop',
      strokeDesc: 'Curve downward from upper right, encircling a complete loop in the lower half.',
      mnistFeature: 'Identified by closed lower cavity and single upper entrance stem.',
      examplePath: 'M 62 25 C 40 22, 28 48, 28 64 C 28 80, 68 80, 68 64 C 68 48, 32 48, 28 64',
    },
    {
      digit: 7,
      title: 'Digit 7: Sharp Top Bar & Diagonal Stem',
      strokeDesc: 'Horizontal line from left to right across the top, followed by diagonal stroke down-left.',
      mnistFeature: 'Identified by top horizontal density and clear empty lower-left quadrant.',
      examplePath: 'M 28 22 L 72 22 L 44 82',
    },
    {
      digit: 8,
      title: 'Digit 8: Figure-Eight Double Loops',
      strokeDesc: 'Continuous infinity loop starting center, forming upper loop, crossing, and lower loop.',
      mnistFeature: 'Identified by dual closed cavities and center intersection crossing.',
      examplePath: 'M 50 48 C 30 48, 30 20, 50 20 C 70 20, 70 48, 50 48 C 26 48, 26 80, 50 80 C 74 80, 74 48, 50 48 Z',
    },
    {
      digit: 9,
      title: 'Digit 9: Top Loop & Descending Stem',
      strokeDesc: 'Complete upper circular loop, continuing down in a vertical or gently curved right stem.',
      mnistFeature: 'Identified by closed upper cavity and right-side vertical descent.',
      examplePath: 'M 68 44 C 68 24, 30 24, 30 44 C 30 60, 68 60, 68 44 L 68 82',
    },
  ];

  const current = digitTips.find((d) => d.digit === selectedDigit) || digitTips[1];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
      <div className="px-5 py-3.5 border-b border-neutral-200 bg-white">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900">
          Neural Handwriting Guide & Cheat Sheet
        </h2>
        <p className="text-xs text-neutral-500">
          Learn how the MNIST recognition model perceives strokes for 100% accuracy
        </p>
      </div>

      <div className="p-5 flex flex-col lg:flex-row gap-6">
        {/* Digits Selector List */}
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 shrink-0">
          {digitTips.map((tip) => (
            <button
              key={tip.digit}
              type="button"
              onClick={() => setSelectedDigit(tip.digit)}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
                selectedDigit === tip.digit
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <span className="font-mono text-base font-bold w-4 text-center">
                {tip.digit}
              </span>
              <span className="truncate hidden sm:inline">
                Digit {tip.digit}
              </span>
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 border border-neutral-200 rounded-lg p-5 bg-white flex flex-col sm:flex-row items-center gap-6">
          {/* Animated SVG Path Sample */}
          <div className="w-32 h-32 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 100 100"
              className="w-24 h-24 stroke-neutral-900 fill-none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={current.examplePath} />
            </svg>
          </div>

          {/* Explanation */}
          <div className="flex-1 space-y-2.5">
            <h3 className="text-base font-bold text-neutral-900">
              {current.title}
            </h3>

            <div>
              <span className="text-xs font-semibold text-neutral-700 block">
                Recommended Stroke:
              </span>
              <p className="text-xs text-neutral-600 mt-0.5">
                {current.strokeDesc}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold text-neutral-700 block">
                Neural / Feature Extraction Signature:
              </span>
              <p className="text-xs text-neutral-500 mt-0.5">
                {current.mnistFeature}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
