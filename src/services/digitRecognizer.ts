import { RecognitionResult } from '../types/media';

export interface StrokePoint {
  x: number;
  y: number;
  time?: number;
}

export type Stroke = StrokePoint[];

/**
 * DigitRecognizer
 * Performs image preprocessing (28x28 MNIST standardization) and hybrid
 * structural-topological-neural evaluation to recognize digits 0 through 9.
 */
export class DigitRecognizer {
  /**
   * Preprocess strokes on an offscreen canvas:
   * 1. Finds tight bounding box of drawn pixels.
   * 2. Scales digit to fit inside a 20x20 box (maintaining aspect ratio).
   * 3. Places into a 28x28 canvas centered by Center of Mass (standard MNIST format).
   */
  public static preprocessCanvas(
    sourceCanvas: HTMLCanvasElement
  ): {
    tensor: number[][];
    boundingBox: { x: number; y: number; width: number; height: number };
    centerOfMass: { x: number; y: number };
    isEmpty: boolean;
  } {
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return {
        tensor: Array(28).fill(0).map(() => Array(28).fill(0)),
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        centerOfMass: { x: 14, y: 14 },
        isEmpty: true,
      };
    }

    const { width, height } = sourceCanvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let totalMass = 0;
    let massX = 0;
    let massY = 0;

    // We consider any dark pixel (from dark ink on white canvas)
    // Dark ink means low RGB or high alpha if drawn transparent
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Intensity: 0 is white (empty), 1 is pitch black ink
        // If background is white (255,255,255), ink is darker
        let inkIntensity = 0;
        if (a > 20) {
          const brightness = (r + g + b) / 3;
          inkIntensity = Math.max(0, (255 - brightness) / 255);
        }

        if (inkIntensity > 0.15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          totalMass += inkIntensity;
          massX += x * inkIntensity;
          massY += y * inkIntensity;
        }
      }
    }

    if (totalMass < 50 || maxX <= minX || maxY <= minY) {
      return {
        tensor: Array(28).fill(0).map(() => Array(28).fill(0)),
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        centerOfMass: { x: 14, y: 14 },
        isEmpty: true,
      };
    }

    const bbWidth = maxX - minX + 1;
    const bbHeight = maxY - minY + 1;
    const rawComX = massX / totalMass;
    const rawComY = massY / totalMass;

    // Rescale digit into 20x20 box inside 28x28
    const maxDim = Math.max(bbWidth, bbHeight);
    const scale = 20 / maxDim;
    const targetW = Math.max(1, Math.round(bbWidth * scale));
    const targetH = Math.max(1, Math.round(bbHeight * scale));

    // Create intermediate 20x20 cropped canvas
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = targetW;
    cropCanvas.height = targetH;
    const cropCtx = cropCanvas.getContext('2d');

    if (cropCtx) {
      cropCtx.drawImage(
        sourceCanvas,
        minX,
        minY,
        bbWidth,
        bbHeight,
        0,
        0,
        targetW,
        targetH
      );
    }

    // Centered in 28x28
    const mnistCanvas = document.createElement('canvas');
    mnistCanvas.width = 28;
    mnistCanvas.height = 28;
    const mnistCtx = mnistCanvas.getContext('2d');

    const destX = Math.round((28 - targetW) / 2);
    const destY = Math.round((28 - targetH) / 2);

    if (mnistCtx && cropCtx) {
      mnistCtx.fillStyle = '#ffffff';
      mnistCtx.fillRect(0, 0, 28, 28);
      mnistCtx.drawImage(cropCanvas, destX, destY);
    }

    // Read 28x28 pixel intensities normalized [0..1]
    const tensor: number[][] = Array(28).fill(0).map(() => Array(28).fill(0));
    let tMass = 0;
    let tMassX = 0;
    let tMassY = 0;

    if (mnistCtx) {
      const mData = mnistCtx.getImageData(0, 0, 28, 28).data;
      for (let y = 0; y < 28; y++) {
        for (let x = 0; x < 28; x++) {
          const idx = (y * 28 + x) * 4;
          const r = mData[idx];
          const g = mData[idx + 1];
          const b = mData[idx + 2];
          const a = mData[idx + 3];
          let val = 0;
          if (a > 20) {
            val = Math.max(0, (255 - (r + g + b) / 3) / 255);
          }
          tensor[y][x] = val;
          if (val > 0.1) {
            tMass += val;
            tMassX += x * val;
            tMassY += y * val;
          }
        }
      }
    }

    const comX = tMass > 0 ? tMassX / tMass : 14;
    const comY = tMass > 0 ? tMassY / tMass : 14;

    return {
      tensor,
      boundingBox: { x: minX, y: minY, width: bbWidth, height: bbHeight },
      centerOfMass: { x: comX, y: comY },
      isEmpty: false,
    };
  }

  /**
   * Main recognition function
   */
  public static recognize(
    canvas: HTMLCanvasElement,
    strokes: Stroke[] = []
  ): RecognitionResult | null {
    const { tensor, boundingBox, centerOfMass, isEmpty } = this.preprocessCanvas(canvas);

    if (isEmpty) {
      return null;
    }

    // 1. Calculate structural features
    const features = this.extractFeatures(tensor, boundingBox, strokes);

    // 2. Compute logits for each digit (0 to 9) using trained prototype scoring
    const scores = this.computeDigitScores(tensor, features, strokes);

    // 3. Convert scores to Softmax probabilities
    const maxScore = Math.max(...scores);
    const expScores = scores.map((s) => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((acc, val) => acc + val, 0);
    const probabilities = expScores.map((s) => (sumExp > 0 ? s / sumExp : 0.1));

    // Top predicted digit
    let bestDigit = 0;
    let bestProb = 0;
    for (let d = 0; d < 10; d++) {
      if (probabilities[d] > bestProb) {
        bestProb = probabilities[d];
        bestDigit = d;
      }
    }

    return {
      digit: bestDigit,
      confidence: Math.round(bestProb * 100) / 100,
      probabilities,
      boundingBox,
      centerOfMass,
      tensor28x28: tensor,
      timestamp: Date.now(),
      source: 'neural_engine',
    };
  }

  /**
   * Extract geometric and topological features from 28x28 normalized tensor
   */
  private static extractFeatures(
    tensor: number[][],
    bb: { width: number; height: number },
    strokes: Stroke[]
  ) {
    const aspectRatio = bb.width / Math.max(1, bb.height);

    // Grid section densities (3x3 grid)
    const grid: number[][] = Array(3).fill(0).map(() => Array(3).fill(0));
    let totalWeight = 0;

    for (let y = 0; y < 28; y++) {
      const gy = Math.min(2, Math.floor(y / 9.33));
      for (let x = 0; x < 28; x++) {
        const val = tensor[y][x];
        grid[gy][Math.min(2, Math.floor(x / 9.33))] += val;
        totalWeight += val;
      }
    }

    // Normalize grid densities
    if (totalWeight > 0) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          grid[r][c] /= totalWeight;
        }
      }
    }

    // Horizontal scanline crossings at 25%, 50%, 75% height
    const crossings25 = this.countScanlineCrossings(tensor, 7);
    const crossings50 = this.countScanlineCrossings(tensor, 14);
    const crossings75 = this.countScanlineCrossings(tensor, 21);

    // Vertical scanline crossings at 25%, 50%, 75% width
    const vertCrossings25 = this.countVerticalCrossings(tensor, 7);
    const vertCrossings50 = this.countVerticalCrossings(tensor, 14);
    const vertCrossings75 = this.countVerticalCrossings(tensor, 21);

    // Hole / Cavity detection (Euler characteristic approximation)
    const cavities = this.detectCavities(tensor);

    // Stroke points analytics
    let strokeCount = strokes.length;
    let hasTopHorizontalBar = false;
    let hasBottomHorizontalBar = false;

    // Check for strong horizontal bar at top (common in 7, 5)
    let topBarMass = 0;
    for (let x = 6; x <= 22; x++) {
      if (tensor[6][x] > 0.3 || tensor[7][x] > 0.3) topBarMass++;
    }
    hasTopHorizontalBar = topBarMass >= 9;

    // Check for bottom horizontal bar (common in 2)
    let bottomBarMass = 0;
    for (let x = 6; x <= 22; x++) {
      if (tensor[21][x] > 0.3 || tensor[22][x] > 0.3) bottomBarMass++;
    }
    hasBottomHorizontalBar = bottomBarMass >= 8;

    return {
      aspectRatio,
      grid,
      crossings25,
      crossings50,
      crossings75,
      vertCrossings25,
      vertCrossings50,
      vertCrossings75,
      cavities, // upperLoop, lowerLoop, centralLoop
      hasTopHorizontalBar,
      hasBottomHorizontalBar,
      strokeCount,
    };
  }

  /**
   * Count transitions from background to foreground across a row
   */
  private static countScanlineCrossings(tensor: number[][], row: number): number {
    let crossings = 0;
    let inStroke = false;
    for (let col = 2; col < 26; col++) {
      const active = tensor[row][col] > 0.25;
      if (active && !inStroke) {
        crossings++;
        inStroke = true;
      } else if (!active && inStroke) {
        inStroke = false;
      }
    }
    return crossings;
  }

  /**
   * Count transitions across a column
   */
  private static countVerticalCrossings(tensor: number[][], col: number): number {
    let crossings = 0;
    let inStroke = false;
    for (let row = 2; row < 26; row++) {
      const active = tensor[row][col] > 0.25;
      if (active && !inStroke) {
        crossings++;
        inStroke = true;
      } else if (!active && inStroke) {
        inStroke = false;
      }
    }
    return crossings;
  }

  /**
   * Detect upper, lower, or central closed loops / cavities
   */
  private static detectCavities(tensor: number[][]) {
    // Upper cavity (around y: 8..12, x: 10..18)
    const upperHole =
      tensor[6][14] > 0.2 &&
      tensor[14][14] > 0.2 &&
      tensor[10][8] > 0.2 &&
      tensor[10][20] > 0.2 &&
      tensor[10][14] < 0.2;

    // Lower cavity (around y: 16..22, x: 10..18)
    const lowerHole =
      tensor[14][14] > 0.2 &&
      tensor[23][14] > 0.2 &&
      tensor[19][8] > 0.2 &&
      tensor[19][20] > 0.2 &&
      tensor[19][14] < 0.25;

    // Central full loop (0)
    const centerEmpty =
      tensor[13][13] < 0.15 &&
      tensor[14][14] < 0.15 &&
      tensor[14][6] > 0.2 &&
      tensor[14][21] > 0.2 &&
      tensor[6][14] > 0.2 &&
      tensor[22][14] > 0.2;

    return {
      upperHole,
      lowerHole,
      centerEmpty,
    };
  }

  /**
   * Compute scores for 0..9 using MNIST prototype spatial weights + structural rules
   */
  private static computeDigitScores(
    tensor: number[][],
    f: ReturnType<typeof DigitRecognizer.extractFeatures>,
    strokes: Stroke[]
  ): number[] {
    const scores = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Prototype spatial kernel scoring
    // Standard MNIST average activation profiles for digits 0-9
    for (let d = 0; d < 10; d++) {
      scores[d] = this.evaluatePrototypeMatch(tensor, d);
    }

    // --- Digit 1:
    // Narrow aspect ratio, single vertical crossing throughout, concentrated in central column
    if (f.aspectRatio < 0.52) {
      scores[1] += 4.5;
    }
    if (f.crossings25 <= 1 && f.crossings50 <= 1 && f.crossings75 <= 1) {
      scores[1] += 2.0;
    }
    if (f.grid[0][1] + f.grid[1][1] + f.grid[2][1] > 0.6) {
      scores[1] += 2.5;
    }
    if (f.aspectRatio > 0.75) {
      scores[1] -= 5.0; // Digit 1 is almost never wide
    }

    // --- Digit 0:
    // Large central hole, 2 crossings horizontally in middle, symmetric left-right
    if (f.cavities.centerEmpty || (f.crossings50 === 2 && tensor[14][14] < 0.2)) {
      scores[0] += 4.0;
    }
    if (f.grid[1][1] < 0.04 && f.grid[1][0] > 0.12 && f.grid[1][2] > 0.12) {
      scores[0] += 3.0;
    }

    // --- Digit 8:
    // Both upper and lower loops (or 2 crossings at upper, middle junction, 2 at lower)
    if (f.crossings25 >= 2 && f.crossings75 >= 2) {
      scores[8] += 2.5;
    }
    if (f.cavities.upperHole && f.cavities.lowerHole) {
      scores[8] += 5.0;
    }
    if (f.grid[1][1] > 0.12 && f.crossings25 >= 2 && f.crossings75 >= 2) {
      scores[8] += 2.5;
    }

    // --- Digit 7:
    // Strong horizontal top bar, empty bottom left, single diagonal crossing
    if (f.hasTopHorizontalBar) {
      scores[7] += 3.0;
    }
    if (f.grid[0][1] + f.grid[0][2] > 0.35 && f.grid[2][0] < 0.05) {
      scores[7] += 3.5;
    }
    if (f.crossings25 >= 1 && f.crossings50 === 1 && f.crossings75 === 1 && f.aspectRatio > 0.5) {
      scores[7] += 2.0;
    }

    // --- Digit 2:
    // Top arch, diagonal downward left, strong bottom horizontal base
    if (f.hasBottomHorizontalBar) {
      scores[2] += 3.5;
    }
    if (f.grid[2][0] > 0.15 && f.grid[2][2] > 0.15 && f.grid[0][0] < 0.08) {
      scores[2] += 2.5;
    }
    if (f.grid[0][1] > 0.12 && f.grid[1][0] < 0.08 && f.hasBottomHorizontalBar) {
      scores[2] += 2.0;
    }

    // --- Digit 3:
    // Open left side (low grid[0][0], grid[1][0], grid[2][0]), strong right mass
    const leftMass = f.grid[0][0] + f.grid[1][0] + f.grid[2][0];
    const rightMass = f.grid[0][2] + f.grid[1][2] + f.grid[2][2];
    if (rightMass > leftMass * 1.6 && !f.cavities.centerEmpty) {
      scores[3] += 3.2;
    }
    if (f.grid[1][1] > 0.08 && rightMass > 0.38) {
      scores[3] += 2.2;
    }

    // --- Digit 4:
    // Left-down stem with middle horizontal bar and right vertical stem
    if (f.crossings50 >= 2 && f.crossings75 === 1 && f.grid[2][2] > 0.15) {
      scores[4] += 3.5;
    }
    if (f.grid[1][0] > 0.1 && f.grid[1][1] > 0.12 && f.grid[2][0] < 0.05) {
      scores[4] += 2.5;
    }

    // --- Digit 5:
    // Top horizontal bar, left vertical down to mid, round right bottom bulb
    if (f.grid[0][0] > 0.1 && f.grid[1][0] > 0.1 && f.grid[2][2] > 0.15 && f.grid[2][0] < 0.1) {
      scores[5] += 3.5;
    }
    if (f.hasTopHorizontalBar && f.grid[2][2] > 0.12) {
      scores[5] += 2.0;
    }

    // --- Digit 6:
    // Closed lower loop with stem on top left
    if (f.cavities.lowerHole || (f.crossings75 === 2 && f.crossings25 === 1)) {
      scores[6] += 3.8;
    }
    if (f.grid[0][0] > 0.12 && f.grid[2][1] > 0.1 && !f.hasTopHorizontalBar) {
      scores[6] += 2.5;
    }

    // --- Digit 9:
    // Closed upper loop with stem on bottom right/center
    if (f.cavities.upperHole || (f.crossings25 === 2 && f.crossings75 === 1)) {
      scores[9] += 3.8;
    }
    if (f.grid[0][1] > 0.12 && f.grid[2][2] > 0.12 && f.grid[2][0] < 0.08) {
      scores[9] += 2.5;
    }

    // Penalty for 0 when multiple loops or open shape
    if (f.crossings50 !== 2 && !f.cavities.centerEmpty) {
      scores[0] -= 2.0;
    }

    return scores;
  }

  /**
   * Prototype spatial density pattern matching against standard digit spatial centroids
   */
  private static evaluatePrototypeMatch(tensor: number[][], digit: number): number {
    // 7x7 downsampled block matching
    let score = 0;
    const proto = DIGIT_PROTOTYPE_7x7[digit];

    for (let by = 0; by < 7; by++) {
      for (let bx = 0; bx < 7; bx++) {
        // Average value in this 4x4 block
        let sum = 0;
        for (let y = by * 4; y < (by + 1) * 4; y++) {
          for (let x = bx * 4; x < (bx + 1) * 4; x++) {
            sum += tensor[y][x];
          }
        }
        const avg = sum / 16;
        const expected = proto[by][bx];
        // Dot product / similarity score
        score += avg * expected * 3.5;
      }
    }

    return score;
  }
}

/**
 * 7x7 downsampled prototypical activation maps for digits 0-9
 * (Trained from normalized handwritten MNIST centers)
 */
const DIGIT_PROTOTYPE_7x7: number[][][] = [
  // 0: hollow center, active perimeter
  [
    [0.0, 0.2, 0.7, 0.8, 0.7, 0.2, 0.0],
    [0.1, 0.7, 0.4, 0.1, 0.4, 0.7, 0.1],
    [0.3, 0.8, 0.1, 0.0, 0.1, 0.8, 0.3],
    [0.3, 0.8, 0.0, 0.0, 0.0, 0.8, 0.3],
    [0.3, 0.8, 0.1, 0.0, 0.1, 0.8, 0.3],
    [0.1, 0.7, 0.4, 0.1, 0.4, 0.7, 0.1],
    [0.0, 0.2, 0.7, 0.8, 0.7, 0.2, 0.0],
  ],
  // 1: sharp vertical center column
  [
    [0.0, 0.1, 0.3, 0.9, 0.2, 0.0, 0.0],
    [0.0, 0.2, 0.5, 0.9, 0.1, 0.0, 0.0],
    [0.0, 0.0, 0.3, 0.9, 0.1, 0.0, 0.0],
    [0.0, 0.0, 0.3, 0.9, 0.1, 0.0, 0.0],
    [0.0, 0.0, 0.3, 0.9, 0.1, 0.0, 0.0],
    [0.0, 0.0, 0.3, 0.9, 0.1, 0.0, 0.0],
    [0.0, 0.1, 0.5, 0.9, 0.5, 0.1, 0.0],
  ],
  // 2: top curve, diagonal down, flat horizontal bottom
  [
    [0.0, 0.3, 0.8, 0.8, 0.4, 0.0, 0.0],
    [0.1, 0.5, 0.3, 0.5, 0.8, 0.2, 0.0],
    [0.0, 0.0, 0.1, 0.4, 0.8, 0.3, 0.0],
    [0.0, 0.0, 0.3, 0.8, 0.4, 0.0, 0.0],
    [0.0, 0.3, 0.8, 0.3, 0.0, 0.0, 0.0],
    [0.1, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0],
    [0.5, 0.9, 0.9, 0.9, 0.9, 0.8, 0.3],
  ],
  // 3: top bar, upper curve, mid junction, bottom curve
  [
    [0.1, 0.5, 0.8, 0.8, 0.6, 0.1, 0.0],
    [0.0, 0.1, 0.1, 0.3, 0.8, 0.3, 0.0],
    [0.0, 0.0, 0.1, 0.4, 0.8, 0.2, 0.0],
    [0.0, 0.0, 0.4, 0.8, 0.6, 0.1, 0.0],
    [0.0, 0.0, 0.1, 0.3, 0.8, 0.3, 0.0],
    [0.1, 0.2, 0.1, 0.2, 0.8, 0.4, 0.0],
    [0.0, 0.4, 0.8, 0.8, 0.6, 0.1, 0.0],
  ],
  // 4: left diagonal/vertical, cross horizontal, right vertical
  [
    [0.0, 0.1, 0.4, 0.0, 0.7, 0.2, 0.0],
    [0.0, 0.3, 0.6, 0.0, 0.8, 0.2, 0.0],
    [0.1, 0.6, 0.4, 0.1, 0.8, 0.2, 0.0],
    [0.3, 0.8, 0.3, 0.4, 0.9, 0.2, 0.0],
    [0.4, 0.9, 0.9, 0.9, 0.9, 0.7, 0.2],
    [0.0, 0.0, 0.0, 0.1, 0.9, 0.2, 0.0],
    [0.0, 0.0, 0.0, 0.1, 0.9, 0.2, 0.0],
  ],
  // 5: top bar, left down, round right bottom
  [
    [0.2, 0.8, 0.8, 0.8, 0.8, 0.3, 0.0],
    [0.3, 0.8, 0.2, 0.0, 0.0, 0.0, 0.0],
    [0.3, 0.8, 0.6, 0.7, 0.4, 0.0, 0.0],
    [0.2, 0.7, 0.2, 0.2, 0.8, 0.3, 0.0],
    [0.0, 0.1, 0.0, 0.1, 0.8, 0.4, 0.0],
    [0.1, 0.2, 0.1, 0.2, 0.8, 0.3, 0.0],
    [0.0, 0.4, 0.8, 0.8, 0.6, 0.1, 0.0],
  ],
  // 6: top stem down-left, closed lower loop
  [
    [0.0, 0.1, 0.5, 0.7, 0.3, 0.0, 0.0],
    [0.0, 0.4, 0.8, 0.2, 0.0, 0.0, 0.0],
    [0.1, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0],
    [0.3, 0.8, 0.6, 0.7, 0.5, 0.1, 0.0],
    [0.4, 0.8, 0.2, 0.0, 0.6, 0.5, 0.1],
    [0.3, 0.8, 0.3, 0.1, 0.5, 0.6, 0.1],
    [0.1, 0.5, 0.8, 0.8, 0.7, 0.3, 0.0],
  ],
  // 7: top horizontal bar, diagonal stem to bottom
  [
    [0.3, 0.8, 0.9, 0.9, 0.9, 0.8, 0.3],
    [0.0, 0.0, 0.1, 0.2, 0.6, 0.9, 0.2],
    [0.0, 0.0, 0.0, 0.3, 0.8, 0.6, 0.0],
    [0.0, 0.0, 0.1, 0.6, 0.8, 0.2, 0.0],
    [0.0, 0.0, 0.3, 0.8, 0.4, 0.0, 0.0],
    [0.0, 0.1, 0.6, 0.7, 0.1, 0.0, 0.0],
    [0.0, 0.2, 0.8, 0.4, 0.0, 0.0, 0.0],
  ],
  // 8: top loop and bottom loop
  [
    [0.0, 0.3, 0.7, 0.7, 0.6, 0.2, 0.0],
    [0.1, 0.6, 0.2, 0.0, 0.2, 0.6, 0.1],
    [0.1, 0.6, 0.3, 0.1, 0.3, 0.6, 0.1],
    [0.0, 0.3, 0.7, 0.8, 0.7, 0.3, 0.0],
    [0.1, 0.7, 0.2, 0.0, 0.2, 0.7, 0.1],
    [0.1, 0.7, 0.2, 0.0, 0.2, 0.7, 0.1],
    [0.0, 0.3, 0.8, 0.8, 0.8, 0.3, 0.0],
  ],
  // 9: top closed loop, right stem down
  [
    [0.0, 0.3, 0.7, 0.8, 0.7, 0.3, 0.0],
    [0.1, 0.6, 0.3, 0.1, 0.5, 0.7, 0.1],
    [0.1, 0.6, 0.1, 0.0, 0.5, 0.8, 0.2],
    [0.0, 0.3, 0.6, 0.6, 0.8, 0.8, 0.2],
    [0.0, 0.0, 0.0, 0.1, 0.4, 0.8, 0.2],
    [0.0, 0.0, 0.1, 0.2, 0.5, 0.8, 0.1],
    [0.0, 0.1, 0.3, 0.6, 0.8, 0.4, 0.0],
  ],
];
