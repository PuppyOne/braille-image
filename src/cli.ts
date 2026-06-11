#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { imageToBraille } from './index.js';

const HELP = `Usage: braille-image <input> [options]

Convert an image file to Unicode braille text art.

Arguments:
  <input>                    Path to the image file

Options:
  -w, --width <cells>        Output width in braille cells (default: auto)
      --height <cells>       Output height in braille cells (default: auto)
  -t, --threshold <n>        Brightness threshold 0-255 (default: 128)
  -i, --invert               Invert image luminance
  -h, --help                 Show this help message
`;

function parseIntStrict(value: string, flag: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`${flag} requires an integer, got "${value}"`);
  }
  return n;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      width: { type: 'string', short: 'w' },
      height: { type: 'string' },
      threshold: { type: 'string', short: 't' },
      invert: { type: 'boolean', short: 'i' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: true,
  });

  /* --help */
  if (values.help) {
    process.stdout.write(HELP);
    return;
  }

  /* Missing input */
  if (positionals.length === 0) {
    console.error('error: no input file specified');
    process.stderr.write(HELP);
    process.exit(1);
  }

  const [input] = positionals;

  /* Parse numeric options */
  const width: number | undefined =
    values.width !== undefined ? parseIntStrict(values.width, '--width') : undefined;
  const height: number | undefined =
    values.height !== undefined ? parseIntStrict(values.height, '--height') : undefined;
  const threshold: number | undefined =
    values.threshold !== undefined ? parseIntStrict(values.threshold, '--threshold') : undefined;

  const result = await imageToBraille(input, {
    width,
    height,
    threshold,
    invert: values.invert || undefined,
  });

  process.stdout.write(result);

  process.stdout.write('\n');
}

main().catch((err: unknown) => {
  if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    console.error(`error: ${err.message}`);
  } else if (err instanceof Error) {
    console.error(`error: ${err.message}`);
  } else {
    console.error('error: unknown error');
  }
  process.exit(1);
});
