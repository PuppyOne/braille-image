# braille-image

Convert images to **Unicode braille text art**.

## Install

```bash
npm i braille-image
```

## CLI

```bash
npx braille-image <input> [options]
```

| Option | Description |
|--------|-------------|
| `-w, --width <cells>` | Output width in braille cells (default: auto) |
| `--height <cells>` | Output height in braille cells (default: auto) |
| `-t, --threshold <n>` | Brightness threshold 0–255 (default: 128) |
| `-i, --invert` | Invert luminance before thresholding |
| `-h, --help` | Show usage |

**Examples:**

```bash
# Auto-sized output
npx braille-image photo.jpg

# Fixed 40-cell wide output
npx braille-image photo.jpg --width 40

# Inverted with custom threshold
npx braille-image photo.jpg --invert --threshold 200
```

## Library API

```ts
import { imageToBraille } from 'braille-image';

const art = await imageToBraille('./photo.jpg', {
  width: 40,
  invert: true,
});

console.log(art);
```

### `imageToBraille(input, options?)`

| Param | Type | Description |
|-------|------|-------------|
| `input` | `string \| Buffer \| Uint8Array` | File path or image buffer |
| `options.threshold` | `number` (0–255) | Brightness cutoff. Default: `128` |
| `options.width` | `number` | Target width in braille cells |
| `options.height` | `number` | Target height in braille cells |
| `options.invert` | `boolean` | Invert luminance. Default: `false` |

**Returns:** `Promise<string>` — braille text with `\n`-separated rows.

**Throws:** `TypeError` on invalid options, `Error` on image processing
failures.

## How it works

1. **Grayscale** — the input image is converted to single-channel luminance
   via [sharp](https://sharp.pixelplumbing.com/).
2. **Resize** — if `width` / `height` are specified, the image is scaled
   to `(width × 2) × (height × 4)` pixels so each braille cell maps to
   exactly one 4×2 pixel block.
3. **Threshold** — each pixel is compared against the `threshold` value.
   Brighter pixels are "raised dots"; darker pixels are left empty.
4. **Braille encoding** — every 4×2 block is packed into one Unicode
   braille character using the standard dot layout:

   ```
   Physical      Bit
    1 .  4      0 .  3
    2 .  5      1 .  4
    3 .  6      2 .  5
    7 .  8      6 .  7
   ```

## Development

This project was built collaboratively with
[**Reasonix Code**](https://reasonix.io).

### Quick start

```bash
git clone https://github.com/PuppyOne/braille-image.git
cd braille-image
npm i
npm run build
npm test
```

### Stack

| Layer | Tool |
|-------|------|
| Runtime | Node.js ≥ 18, ESM |
| Image processing | [sharp](https://sharp.pixelplumbing.com/) |
| Build | [tsdown](https://tsdown.dev) |
| Test | [vitest](https://vitest.dev) |
| Language | TypeScript 6 |

## License

Apache-2.0
