#!/usr/bin/env node
/** QA helper: render specific frames as PNGs.  node scripts/stills.mjs <props.json> <outDir> <frame...> */
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [propsPath, outDir, ...frames] = process.argv.slice(2);
const inputProps = JSON.parse(fs.readFileSync(propsPath, 'utf8'));
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'src/remotion/index.ts'), publicDir: path.join(root, 'public')});
const composition = await selectComposition({serveUrl, id: 'SoccerBrain', inputProps, browserExecutable});
for (const f of frames.map(Number)) {
  const output = path.join(outDir, `frame-${String(f).padStart(4, '0')}.png`);
  await renderStill({composition, serveUrl, output, frame: f, inputProps, browserExecutable, logLevel: 'error'});
  console.log(output);
}
