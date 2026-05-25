// Dev-server endpoints for per-scenario game-save persistence to disk.
//
// Endpoints (mounted on the Vite dev server middleware stack):
//   GET    /__game/load?scenarioId=ID   → returns saved JSON (or 204 if none)
//   POST   /__game/save?scenarioId=ID   → body = JSON, writes to file
//   POST   /__game/reset?scenarioId=ID  → deletes the save file
//
// Saves live as `md/saves/<scenarioId>.json` so they're discoverable next to
// the other game data and can be diffed / committed if the user wants. Only
// registered under `vite dev`; not part of any production bundle.

import type { Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

interface Options {
  /** Absolute directory where per-scenario save JSONs live. */
  savesDir: string;
}

const SAFE_ID = /^[a-z0-9_]+$/;

export function gameSaveSyncPlugin({ savesDir }: Options): Plugin {
  return {
    name: 'game-save-sync',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/__game/')) { next(); return; }
        const url = new URL(req.url, 'http://x');
        const scenarioId = url.searchParams.get('scenarioId');
        if (!scenarioId || !SAFE_ID.test(scenarioId)) {
          res.statusCode = 400;
          res.end('invalid scenarioId (must match /^[a-z0-9_]+$/)');
          return;
        }
        const filePath = path.join(savesDir, `${scenarioId}.json`);

        // LOAD ----------------------------------------------------------------
        if (url.pathname === '/__game/load' && (req.method === 'GET' || req.method === 'HEAD')) {
          try {
            const data = await fs.readFile(filePath, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(data);
          } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
              res.statusCode = 204;        // no saved session
              res.end();
            } else {
              res.statusCode = 500;
              res.end((e as Error).message);
            }
          }
          return;
        }

        // SAVE ----------------------------------------------------------------
        if (url.pathname === '/__game/save' && (req.method === 'POST' || req.method === 'PUT')) {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const body = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(body);     // validates JSON
            await fs.mkdir(savesDir, { recursive: true });
            const tmp = filePath + '.tmp';
            await fs.writeFile(tmp, JSON.stringify(parsed, null, 2), 'utf8');
            await fs.rename(tmp, filePath);      // atomic-ish
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: true, savedTo: filePath }));
          } catch (e) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
          }
          return;
        }

        // RESET --------------------------------------------------------------
        if (url.pathname === '/__game/reset' && (req.method === 'POST' || req.method === 'DELETE')) {
          try {
            await fs.unlink(filePath);
          } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
              res.statusCode = 500;
              res.end((e as Error).message);
              return;
            }
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        next();
      });
    },
  };
}
