// Dev-server endpoint that lets the review UI read/write a comments JSON file
// directly on disk, no manual download required.
//
// Endpoints (mounted on the Vite dev server middleware stack):
//   GET  /__review/load   → returns the current contents of `filePath`, or
//                           an empty CommentsFile if the file doesn't exist
//   POST /__review/save   → body = JSON; validates + writes pretty-printed to
//                           `filePath` (atomic-ish via temp file rename)
//
// Production builds DO NOT expose these endpoints (we only register them in
// configureServer, which runs only under `vite dev`). The data files are
// dev-time tooling — they don't ship with the bundle.

import type { Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface Options {
  /** Absolute path to the JSON file we read/write. */
  filePath: string;
}

const EMPTY_PAYLOAD = {
  schema_version: 1,
  generated_at: new Date(0).toISOString(),
  comments: [],
};

export function reviewSyncPlugin({ filePath }: Options): Plugin {
  return {
    name: 'review-sync',
    apply: 'serve',                         // dev only
    configureServer(server) {
      server.middlewares.use('/__review/load', async (req, res) => {
        if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        try {
          const data = await fs.readFile(filePath, 'utf8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(data);
        } catch (e: unknown) {
          const code = (e as NodeJS.ErrnoException).code;
          if (code === 'ENOENT') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(EMPTY_PAYLOAD));
          } else {
            res.statusCode = 500;
            res.end((e as Error).message);
          }
        }
      });

      server.middlewares.use('/__review/save', async (req, res) => {
        if (req.method !== 'POST' && req.method !== 'PUT') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const body = Buffer.concat(chunks).toString('utf8');
          // Validate that it's parseable JSON before writing.
          const parsed = JSON.parse(body);
          // Ensure the destination directory exists, then write via a temp
          // file so a partial write can't corrupt the existing file.
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          const tmp = filePath + '.tmp';
          await fs.writeFile(tmp, JSON.stringify(parsed, null, 2), 'utf8');
          await fs.rename(tmp, filePath);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, savedTo: filePath }));
        } catch (e) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
        }
      });
    },
  };
}
