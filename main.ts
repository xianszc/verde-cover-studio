// VERDE HEAT Cover Studio — the hand-in program for gta6-cover-art-01
// (Node 22, standard library only; re-witnessed build, November 2026).
//
// The app itself is the plain static files under app/: index.html opens in a
// desktop browser and works with no network at all. This program copies app/
// and screenshots/ next to this file into /output and writes the dossier the
// judge reads, using the vendored make.fun library.
//
// Try it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function main() {
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(rootDir, 'app'), join(targetDir, 'app'), { recursive: true });
  mkdirSync(join(targetDir, 'screenshots'), { recursive: true });
  const shotsDir = join(rootDir, 'screenshots');
  if (existsSync(shotsDir)) cpSync(shotsDir, join(targetDir, 'screenshots'), { recursive: true });

  // The scorer's own caps (reference/gate.json): text_max_bytes shapes the
  // dossier bytes; the others refuse an entry the scorer would refuse — more
  // than 4 screenshots or one over 256 KiB, more than 993 files in app/ or
  // 48 MiB of app files in all, or a path under app/ over 1000 bytes.
  const dossier = buildDossier(targetDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  });
  writeFileSync(join(targetDir, 'dossier.json'), dossier);
}

main();
