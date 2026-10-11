import { z } from 'zod';
import { runAgentSession } from './_lib/agent';
import { ApiError, defineEndpoint } from './_lib/http';
import { LlmError } from './_lib/llm';
import { getRuntime, sessionCap } from './_lib/runtime';
import { sessionRequestSchema } from './_lib/schemas';

const agentRequestSchema = sessionRequestSchema.extend({ instruction: z.string().trim().min(3).max(300) });

/** "Ask Echoes": the AI picks Qloo tools to follow a caregiver's instruction. Shares the session rate cap. */
export default defineEndpoint({ method: 'POST', schema: agentRequestSchema, cap: sessionCap }, async ({ instruction, ...req }) => {
  const runtime = getRuntime();
  if (!runtime.llm) {
    throw new ApiError(503, 'no_llm', 'Ask Echoes needs the AI service, which is not set up on this server. You can still use the standard session.');
  }
  try {
    return await runAgentSession(req, instruction, runtime);
  } catch (e) {
    if (e instanceof LlmError) {
      const quota = e.status === 429;
      throw new ApiError(
        503,
        quota ? 'llm_quota' : 'llm_unavailable',
        quota
          ? "The AI provider's free-tier limit was reached. Wait a minute and try again."
          : 'The AI service is unavailable right now. Please try again in a minute.',
      );
    }
    throw e;
  }
});
