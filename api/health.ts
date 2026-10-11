import { z } from 'zod';
import type { HealthInfo } from '../shared/types';
import { defineEndpoint } from './_lib/http';
import { callBudget } from './_lib/limiter';
import { getRuntime } from './_lib/runtime';

/** Reports the active mode only. No keys, no env values. */
export default defineEndpoint({ method: 'GET', schema: z.object({}).passthrough() }, async (): Promise<HealthInfo> => {
  const { qloo, llm } = getRuntime();
  return {
    ok: true,
    mode: qloo.mode,
    idSpace: qloo.idSpace,
    llm: llm?.name ?? null,
    agent: llm !== null,
    hasRecorded: qloo.hasRecorded,
    budget: { used: callBudget.used, limit: callBudget.limit },
  };
});
