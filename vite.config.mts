import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

type DevRes = ServerResponse & { status(code: number): DevRes; json(body: unknown): void };
type Handler = (req: unknown, res: unknown) => Promise<void>;

/** Serves /api/*.ts handlers in `npm run dev` so no Vercel login is needed. */
function devApi(): Plugin {
  return {
    name: 'echoes-dev-api',
    configureServer(server) {
      server.middlewares.use('/api', (req: IncomingMessage, res: ServerResponse, next) => {
        void (async () => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const name = url.pathname.replace(/[^a-z-]/gi, '');
          if (!name) return next();
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          let body: unknown;
          try {
            body = raw ? JSON.parse(raw) : undefined;
          } catch {
            body = undefined;
          }
          const apiReq = Object.assign(req, { query: Object.fromEntries(url.searchParams), body });
          const apiRes = res as DevRes;
          apiRes.status = (code: number) => {
            res.statusCode = code;
            return apiRes;
          };
          apiRes.json = (payload: unknown) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
          };
          try {
            const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as { default?: Handler };
            if (!mod.default) return next();
            await mod.default(apiReq, apiRes);
          } catch (e) {
            console.error(e);
            apiRes.status(500).json({ error: { code: 'dev', message: 'Dev API failed to load.' } });
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
  return {
    plugins: [react(), devApi()],
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
