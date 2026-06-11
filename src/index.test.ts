import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { imageToBraille } from './index.js';

describe('imageToBraille', () => {
  let allWhiteBuffer: Buffer;
  let allBlackBuffer: Buffer;
  let checkeredBuffer: Buffer;
  let gradientBuffer: Buffer;

  beforeAll(async () => {
    // 2×4 image — 1 braille cell, all white
    allWhiteBuffer = await sharp({
      create: { width: 2, height: 4, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    // 2×4 image — 1 braille cell, all black
    allBlackBuffer = await sharp({
      create: { width: 2, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    // 4×4 image — 2 braille cells wide, 1 tall
    // Cell 0: left column all white, right column all black
    // Cell 1: left column all black, right column all white
    const checkeredPixels = Buffer.alloc(4 * 4);
    for (let y = 0; y < 4; y++) {
      checkeredPixels[y * 4 + 0] = 255;
      checkeredPixels[y * 4 + 1] = 0;
      checkeredPixels[y * 4 + 2] = 0;
      checkeredPixels[y * 4 + 3] = 255;
    }
    checkeredBuffer = await sharp(checkeredPixels, {
      raw: { width: 4, height: 4, channels: 1 },
    })
      .png()
      .toBuffer();

    // 10×20 gradient — ~5×5 braille cells
    const gradPixels = Buffer.alloc(10 * 20);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        gradPixels[y * 10 + x] = Math.floor(((x / 10 + y / 20) / 2) * 255);
      }
    }
    gradientBuffer = await sharp(gradPixels, {
      raw: { width: 10, height: 20, channels: 1 },
    })
      .png()
      .toBuffer();
  });

  /* ---------- Basic output ---------- */

  it('should output a string', async () => {
    const result = await imageToBraille(allWhiteBuffer);
    expect(result).toBeTypeOf('string');
  });

  it('should produce empty braille for all-black 2×4 image', async () => {
    const result = await imageToBraille(allBlackBuffer);
    expect(result).toMatchInlineSnapshot(`"⠀"`);
  });

  it('should produce filled braille for all-white 2×4 image', async () => {
    const result = await imageToBraille(allWhiteBuffer);
    expect(result).toMatchInlineSnapshot(`"⣿"`);
  });

  /* ---------- Dimensions ---------- */

  it('should respect custom width and height in braille cells', async () => {
    const result = await imageToBraille(gradientBuffer, { width: 3, height: 2 });
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(3);
    // Snapshot the full output to catch content regressions
    expect(result).toMatchInlineSnapshot(`
      "⠀⠀⣰
      ⢀⣾⣿"
    `);
  });

  it('should infer dimensions from image size when not specified', async () => {
    const result = await imageToBraille(gradientBuffer);
    const lines = result.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toHaveLength(5);
    expect(result).toMatchInlineSnapshot(`
      "⠀⠀⠀⠀⢀
      ⠀⠀⠀⢀⣾
      ⠀⠀⢀⣾⣿
      ⠀⢀⣾⣿⣿
      ⢀⣾⣿⣿⣿"
    `);
  });

  /* ---------- Inversion ---------- */

  it('should invert colors when invert is true', async () => {
    const normal = await imageToBraille(allWhiteBuffer);
    const inverted = await imageToBraille(allWhiteBuffer, { invert: true });
    expect(normal).not.toBe(inverted);
    expect(inverted).toMatchInlineSnapshot(`"⠀"`);
  });

  /* ---------- Threshold ---------- */

  it('should treat near-white pixels as lit with low threshold', async () => {
    const result = await imageToBraille(allWhiteBuffer, { threshold: 254 });
    expect(result).toMatchInlineSnapshot(`"⣿"`);
  });

  it('should treat near-white pixels as dark with very high threshold', async () => {
    const result = await imageToBraille(allWhiteBuffer, { threshold: 255 });
    expect(result).toMatchInlineSnapshot(`"⠀"`);
  });

  /* ---------- Buffer input ---------- */

  it('should accept a raw Uint8Array buffer as input', async () => {
    const raw = new Uint8Array(allBlackBuffer);
    const result = await imageToBraille(raw);
    expect(result).toMatchInlineSnapshot(`"⠀"`);
  });

  /* ---------- Error handling ---------- */

  it('should throw TypeError for null input', async () => {
    // @ts-expect-error — testing invalid input
    await expect(imageToBraille(null)).rejects.toThrow(TypeError);
  });

  it('should throw TypeError for undefined input', async () => {
    // @ts-expect-error — testing invalid input
    await expect(imageToBraille(undefined)).rejects.toThrow(TypeError);
  });

  it('should throw TypeError for negative threshold', async () => {
    await expect(imageToBraille(allWhiteBuffer, { threshold: -1 })).rejects.toThrow(TypeError);
  });

  it('should throw TypeError for out-of-range threshold', async () => {
    await expect(imageToBraille(allWhiteBuffer, { threshold: 300 })).rejects.toThrow(TypeError);
  });

  it('should throw TypeError for non-integer threshold', async () => {
    await expect(imageToBraille(allWhiteBuffer, { threshold: 12.5 })).rejects.toThrow(TypeError);
  });

  it('should throw TypeError for zero-width', async () => {
    await expect(imageToBraille(allWhiteBuffer, { width: 0 })).rejects.toThrow(TypeError);
  });

  it('should throw TypeError for negative height', async () => {
    await expect(imageToBraille(allWhiteBuffer, { height: -5 })).rejects.toThrow(TypeError);
  });

  it('should throw for a non-existent file path', async () => {
    await expect(imageToBraille('./nonexistent-file-xyz.png')).rejects.toThrow(Error);
  });

  /* ---------- Checkered pattern ---------- */

  it('should produce two different braille characters for a checkered 4×4 image', async () => {
    const result = await imageToBraille(checkeredBuffer);
    expect(result).toBeTypeOf('string');
    const lines = result.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(2);
    expect(lines[0][0]).not.toBe(lines[0][1]);
    expect(result).toMatchInlineSnapshot(`"⡇⢸"`);
  });

  /* ---------- Line consistency ---------- */

  it('should have consistent line lengths across all rows', async () => {
    const result = await imageToBraille(gradientBuffer);
    expect(result).toContain('\n');
    const lines = result.split('\n');
    const lengths = lines.map((l) => l.length);
    expect(new Set(lengths).size).toBe(1);
  });
});
