import sharp from 'sharp';

/**
 * Options for {@link imageToBraille}.
 */
export interface ImageToBrailleOptions {
  /**
   * Brightness threshold (0–255). Pixels with luminance above this value
   * are considered "lit" (raised dot). Default: 128.
   */
  threshold?: number;

  /**
   * Target width in braille cells. Each cell is 2 pixels wide.
   * If omitted, derived from the input image width (floor(width / 2)).
   */
  width?: number;

  /**
   * Target height in braille cells. Each cell is 4 pixels tall.
   * If omitted, derived from the input image height (floor(height / 4)).
   */
  height?: number;

  /**
   * Invert the image luminance before thresholding. Default: false.
   */
  invert?: boolean;
}

/*
 * Braille dot-to-bit layout:
 *
 *   1 .  4    0 .  3
 *   2 .  5    1 .  4
 *   3 .  6    2 .  5
 *   7 .  8    6 .  7
 */
const BRAILLE_BITMAP: readonly [number, number][] = [
  [0, 3], // row 0 → dots 1, 4
  [1, 4], // row 1 → dots 2, 5
  [2, 5], // row 2 → dots 3, 6
  [6, 7], // row 3 → dots 7, 8
];

/**
 * Convert a 4×2 pixel block to a single Unicode braille character.
 *
 * @param data  Flat grayscale pixel array (row-major).
 * @param width Width of the source image in pixels.
 * @param x     Left-edge X of the block (must be < width - 1).
 * @param y     Top-edge Y of the block (must be < height - 3).
 * @param threshold  Luminance threshold [0–255].
 * @returns A single Unicode braille character (U+2800 – U+28FF).
 */
function pixelsToBraille(
  data: Uint8Array,
  width: number,
  x: number,
  y: number,
  threshold: number,
): string {
  let codePoint = 0x2800;

  for (let row = 0; row < 4; row++) {
    const [leftBit, rightBit] = BRAILLE_BITMAP[row];
    const yPos = y + row;

    const leftPixel = data[yPos * width + x];
    if (leftPixel !== undefined && leftPixel > threshold) {
      codePoint |= 1 << leftBit;
    }

    const rightPixel = data[yPos * width + x + 1];
    if (rightPixel !== undefined && rightPixel > threshold) {
      codePoint |= 1 << rightBit;
    }
  }

  return String.fromCodePoint(codePoint);
}

function assertIntegerInRange(
  value: unknown,
  name: string,
  min: number,
  max: number,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new TypeError(
      `imageToBraille: ${name} must be an integer between ${min} and ${max}, got ${String(value)}`,
    );
  }
}

/**
 * Convert an image to a Unicode braille-text representation.
 *
 * Every 4×2 block of pixels in the source image becomes a single braille
 * character (U+2800 – U+28FF).  The output is a string with newline-separated
 * rows, where each row contains one braille character per 2-pixel column.
 *
 * @param input  File path (string) or image buffer (Buffer / Uint8Array).
 * @param options  Conversion options (see {@link ImageToBrailleOptions}).
 * @returns A promise that resolves to the braille-text string.
 *
 * @throws {TypeError}  On invalid option values or null/undefined input.
 * @throws {Error}      On image processing failures (corrupt file, I/O, etc.).
 *
 * @example
 * ```ts
 * import { imageToBraille } from 'braille-image';
 *
 * const art = await imageToBraille('./photo.jpg', { width: 40, invert: true });
 * console.log(art);
 * ```
 */
export async function imageToBraille(
  input: string | Buffer | Uint8Array,
  options: ImageToBrailleOptions = {},
): Promise<string> {
  /* ---- Validate input ---- */
  if (input === undefined || input === null) {
    throw new TypeError('imageToBraille: input must be a file path (string) or image buffer');
  }

  const { threshold = 128, width: targetWidth, height: targetHeight, invert = false } = options;

  assertIntegerInRange(threshold, 'threshold', 0, 255);

  if (targetWidth !== undefined) {
    assertIntegerInRange(targetWidth, 'width', 1, 1_000_000);
  }
  if (targetHeight !== undefined) {
    assertIntegerInRange(targetHeight, 'height', 1, 1_000_000);
  }

  /* ---- Image processing via sharp ---- */
  const sharpInput: string | Buffer =
    input instanceof Uint8Array && !Buffer.isBuffer(input)
      ? Buffer.from(input)
      : (input as string | Buffer);

  let pipeline = sharp(sharpInput).grayscale();

  if (invert) {
    pipeline = pipeline.negate();
  }

  // Resize to exact pixel dimensions (each braille cell = 2 wide × 4 tall).
  if (targetWidth !== undefined || targetHeight !== undefined) {
    const pixelWidth = targetWidth !== undefined ? targetWidth * 2 : undefined;
    const pixelHeight = targetHeight !== undefined ? targetHeight * 4 : undefined;
    pipeline = pipeline.resize(pixelWidth, pixelHeight, { fit: 'fill' });
  }

  let data: Uint8Array;
  let imageWidth: number;
  let imageHeight: number;

  try {
    const result = await pipeline.raw().toBuffer({ resolveWithObject: true });
    data = new Uint8Array(result.data);
    imageWidth = result.info.width;
    imageHeight = result.info.height;
  } catch (err) {
    throw new Error(
      `imageToBraille: failed to process image — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  /* ---- Convert to braille ---- */
  const cols = imageWidth >> 1; // floor(width / 2)
  const rows = imageHeight >> 2; // floor(height / 4)

  if (cols === 0 || rows === 0) {
    throw new Error(
      `imageToBraille: image too small (${imageWidth}×${imageHeight}) — ` +
        'need at least 2×4 pixels for one braille cell',
    );
  }

  const lines: string[] = [];

  for (let row = 0; row < rows; row++) {
    let line = '';
    const yBase = row << 2; // row * 4

    for (let col = 0; col < cols; col++) {
      line += pixelsToBraille(data, imageWidth, col << 1, yBase, threshold);
    }

    lines.push(line);
  }

  return lines.join('\n');
}
