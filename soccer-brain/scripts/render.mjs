#!/usr/bin/env node
/**
 * The one and only render path. Python (CLI, studio, batch) writes a jobs file and
 * calls:  node scripts/render.mjs <jobs.json>
 *
 * jobs.json: {"browserExecutable": str|null, "concurrency": int|null,
 *             "jobs": [{"id", "props", "output", "thumbnail": {"path", "frame"}|null}]}
 *
 * Emits one JSON object per line on stdout: bundle/progress/done/error events.
 * One failing job does not stop the others.
 */
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const emit = (o) => process.stdout.write(JSON.stringify(o) + '\n');

const main = async () => {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browserExecutable = spec.browserExecutable ?? null;
  const t0 = Date.now();
  let lastBundle = -1;
  const serveUrl = await bundle({
    entryPoint: path.join(root, 'src/remotion/index.ts'),
    publicDir: spec.publicDir ?? path.join(root, 'public'),
    onProgress: (p) => {
      if (p - lastBundle >= 25 || p === 100) {
        lastBundle = p;
        emit({event: 'bundle', progress: p / 100});
      }
    },
  });
  emit({event: 'bundled', seconds: (Date.now() - t0) / 1000});

  let failures = 0;
  for (const job of spec.jobs) {
    const started = Date.now();
    try {
      fs.mkdirSync(path.dirname(job.output), {recursive: true});
      const composition = await selectComposition({serveUrl, id: 'SoccerBrain', inputProps: job.props, browserExecutable, logLevel: 'error'});
      let last = -1;
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        audioCodec: 'aac',
        audioBitrate: '192k',
        crf: 18,
        pixelFormat: 'yuv420p',
        colorSpace: 'bt709',
        imageFormat: 'jpeg',
        jpegQuality: 92,
        outputLocation: job.output,
        inputProps: job.props,
        browserExecutable,
        concurrency: spec.concurrency ?? null,
        logLevel: 'error',
        onProgress: ({progress, stitchStage}) => {
          const pct = Math.floor(progress * 100);
          if (pct !== last) {
            last = pct;
            emit({event: 'progress', job: job.id, progress, stage: stitchStage});
          }
        },
      });
      if (job.thumbnail) {
        await renderStill({
          composition,
          serveUrl,
          output: job.thumbnail.path,
          frame: job.thumbnail.frame,
          inputProps: job.props,
          imageFormat: 'png',
          browserExecutable,
          logLevel: 'error',
        });
      }
      emit({event: 'done', job: job.id, output: job.output, seconds: (Date.now() - started) / 1000});
    } catch (err) {
      failures++;
      emit({event: 'error', job: job.id, message: String(err?.stack ?? err)});
    }
  }
  emit({event: 'finished', failures});
  process.exit(failures ? 2 : 0);
};

main().catch((err) => {
  emit({event: 'fatal', message: String(err?.stack ?? err)});
  process.exit(1);
});
