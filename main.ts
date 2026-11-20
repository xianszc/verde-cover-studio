// VERDE HEAT Cover Studio — hand-in program (Node 22, standard library only).
//
// The grader runs this file twice in a fresh container: it copies the
// app's static files and the screenshots into the output folder and writes
// the dossier the judge reads, using the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(destination, { recursive: true });
cpSync(join(repoRoot, 'app'), join(destination, 'app'), { recursive: true });
mkdirSync(join(destination, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(destination, 'screenshots'), { recursive: true });
}

// The scorer's caps: text_max_bytes shapes the dossier text; the rest
// refuse an entry the scorer would refuse anyway (too many or too large
// screenshots, too many app files, too many app bytes, too long a path).
const dossier = buildDossier(destination, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(destination, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes`);
