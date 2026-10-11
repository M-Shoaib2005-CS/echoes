import { defineEndpoint } from './_lib/http';
import { runCompare } from './_lib/pipeline';
import { getRuntime, sessionCap } from './_lib/runtime';
import { sessionRequestSchema } from './_lib/schemas';

export default defineEndpoint({ method: 'POST', schema: sessionRequestSchema, cap: sessionCap }, (req) => runCompare(req, getRuntime()));
