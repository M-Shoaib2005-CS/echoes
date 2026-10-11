import type { ZodType, ZodTypeDef } from 'zod';
import { ZodError } from 'zod';
import type { IpCap } from './limiter';

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): unknown;
}

/** Errors whose message is safe and kind enough to show to a caregiver. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const header = (req: ApiRequest, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

export function isSameOrigin(req: ApiRequest): boolean {
  if (header(req, 'sec-fetch-site') === 'cross-site') return false;
  const origin = header(req, 'origin');
  const host = header(req, 'x-forwarded-host') ?? header(req, 'host');
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const clientIp = (req: ApiRequest): string =>
  (header(req, 'x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof ZodError) {
    return new ApiError(400, 'invalid', "That didn't look quite right. Please check what you entered and try again.");
  }
  console.error('[api] unexpected error', e);
  return new ApiError(500, 'internal', 'Something went wrong on our side. Please try again, or open a ready-made session.');
}

export function defineEndpoint<T>(
  opts: { method: 'GET' | 'POST'; schema: ZodType<T, ZodTypeDef, unknown>; cap?: IpCap },
  run: (input: T) => Promise<unknown>,
) {
  return async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method !== opts.method) throw new ApiError(405, 'method', 'That kind of request is not supported here.');
      if (!isSameOrigin(req)) throw new ApiError(403, 'origin', 'This service only answers requests from the Echoes site.');
      if (opts.cap && !opts.cap.allow(clientIp(req))) {
        throw new ApiError(429, 'rate_limit', 'Lots of requests just now. Please wait a minute and try again, or open a ready-made session.');
      }
      const input = opts.schema.parse(opts.method === 'GET' ? req.query : req.body);
      res.status(200).json(await run(input));
    } catch (e) {
      const err = toApiError(e);
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
  };
}
