import { defineEndpoint } from './_lib/http';
import { runSession } from './_lib/pipeline';
import { getRuntime, sessionCap } from './_lib/runtime';
import { sessionRequestSchema } from './_lib/schemas';

export default defineEndpoint({ method: 'POST', schema: sessionRequestSchema, cap: sessionCap }, (req) => runSession(req, getRuntime()));
