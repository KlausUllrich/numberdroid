import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { preparePropPng } from "./toolkit/prop-source.mjs";

function usage() {
  return `Usage:\n  node scripts/art/prepare-prop-asset.mjs --input source.png --output runtime.png --width 192 --height 128 [--margin 3] [--alpha-cutoff 4]\n\nThis tool requires a source with real alpha transparency. It crops surviving alpha, performs premultiplied-alpha Lanczos fitting, and writes an exact transparent runtime canvas. It does not perform semantic background removal.`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument ${key}.`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${key}.`);
    out[key.slice(2)] = value;
    i += 1;
  }
  return out;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function nonNegativeInteger(value, name, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer.`);
  return parsed;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output || !args.width || !args.height) throw new Error(usage());

  const targetWidth = positiveInteger(args.width, "--width");
  const targetHeight = positiveInteger(args.height, "--height");
  const margin = nonNegativeInteger(args.margin, "--margin", 3);
  const alphaCutoff = nonNegativeInteger(args["alpha-cutoff"], "--alpha-cutoff", 4);
  if (alphaCutoff > 255) throw new Error("--alpha-cutoff must be between 0 and 255.");

  const input = resolve(args.input);
  const output = resolve(args.output);
  const result = preparePropPng({
    bytes: readFileSync(input),
    targetWidth,
    targetHeight,
    margin,
    alphaCutoff,
    requireTransparency: true,
  });

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, result.png);

  console.log(`Prop source: ${result.sourceWidth}x${result.sourceHeight}`);
  console.log(`Alpha crop: x=${result.sourceBounds.x}, y=${result.sourceBounds.y}, w=${result.sourceBounds.w}, h=${result.sourceBounds.h}`);
  console.log(`Runtime content: x=${result.contentBounds.x}, y=${result.contentBounds.y}, w=${result.contentBounds.w}, h=${result.contentBounds.h}`);
  console.log(`Runtime canvas: ${targetWidth}x${targetHeight}; alpha cutoff=${alphaCutoff}; margin=${margin}`);
  console.log(`Wrote ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
