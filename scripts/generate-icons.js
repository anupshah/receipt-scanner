import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../public/icons/icon.svg');
const outDir  = join(__dirname, '../public/icons');

mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png (${size}×${size})`);
}
