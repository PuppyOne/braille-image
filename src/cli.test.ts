import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const CLI = ['node', 'dist/cli.mjs'];

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync([...CLI, ...args].join(' '), {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { stdout: string; stderr: string; status: number };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      status: err.status ?? 1,
    };
  }
}

describe('CLI', () => {
  let tmpDir: string;
  let black4x8: string; // 4×8 → 2 braille cells wide, 2 tall
  let white4x8: string;
  let black2x4: string; // 1 braille cell

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'braille-cli-test-'));

    // All-black 4×8 → 2×2 braille cells
    const blackBuf = await sharp({
      create: { width: 4, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    black4x8 = join(tmpDir, 'black-4x8.png');
    writeFileSync(black4x8, blackBuf);

    // All-white 4×8
    const whiteBuf = await sharp({
      create: { width: 4, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();
    white4x8 = join(tmpDir, 'white-4x8.png');
    writeFileSync(white4x8, whiteBuf);

    // All-black 2×4 → 1 braille cell
    const smallBuf = await sharp({
      create: { width: 2, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    black2x4 = join(tmpDir, 'black-2x4.png');
    writeFileSync(black2x4, smallBuf);
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /* ---------- Help & usage ---------- */

  it('should print usage and exit 0 with --help', () => {
    const { stdout, stderr, status } = run(['--help']);
    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('--width');
    expect(stdout).toContain('--invert');
  });

  it('should print usage and exit 0 with -h', () => {
    const { stdout, status } = run(['-h']);
    expect(status).toBe(0);
    expect(stdout).toContain('Usage:');
  });

  it('should print error and exit non-zero with no args', () => {
    const { stderr, status } = run([]);
    expect(status).toBe(1);
    expect(stderr).toContain('error:');
  });

  /* ---------- Invalid flags ---------- */

  it('should exit non-zero for unknown flags', () => {
    const { stderr, status } = run(['--bogus', black2x4]);
    expect(status).toBe(1);
    expect(stderr).toContain('error:');
  });

  it('should exit non-zero for non-integer --width', () => {
    const { stderr, status } = run(['--width', 'abc', black2x4]);
    expect(status).toBe(1);
    expect(stderr).toContain('error:');
  });

  /* ---------- Non-existent file ---------- */

  it('should exit non-zero for a non-existent file', () => {
    const { stderr, status } = run(['/nonexistent/path.png']);
    expect(status).toBe(1);
    expect(stderr).toContain('error:');
  });

  /* ---------- Basic conversion ---------- */

  it('should output empty braille for a all-black 2×4 image', () => {
    const { stdout, stderr, status } = run([black2x4]);
    expect(status).toBe(0);
    expect(stderr).toBe('');
    // 1 braille cell + trailing newline
    expect(stdout).toMatchInlineSnapshot(`"⠀\n"`);
  });

  it('should output filled braille for an all-white 4×8 image', () => {
    const { stdout, status } = run([white4x8]);
    expect(status).toBe(0);
    // 2×2 braille cells, all filled
    expect(stdout).toMatchInlineSnapshot(`
      "⣿⣿
      ⣿⣿
      "
    `);
  });

  /* ---------- Flags ---------- */

  it('should respect --width', () => {
    // 4×8 image with --width 4 → 4 cells wide, 2 cells tall (auto-height)
    const { stdout, status } = run(['--width', '4', black4x8]);
    expect(status).toBe(0);
    const lines = stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveLength(4);
    expect(stdout).toMatchInlineSnapshot(`
      "⠀⠀⠀⠀
      ⠀⠀⠀⠀
      "
    `);
  });

  it('should produce different output with --invert', () => {
    const normal = run([white4x8]);
    const inverted = run(['--invert', white4x8]);
    expect(normal.status).toBe(0);
    expect(inverted.status).toBe(0);
    // Inverted white = black = empty braille
    expect(inverted.stdout).toMatchInlineSnapshot(`
      "⠀⠀
      ⠀⠀
      "
    `);
  });

  /* ---------- Exit code on processing error ---------- */

  it('should exit non-zero for a corrupt file', () => {
    const corrupt = join(tmpDir, 'corrupt.png');
    writeFileSync(corrupt, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
    const { stderr, status } = run([corrupt]);
    expect(status).toBe(1);
    expect(stderr).toContain('error:');
  });
});
