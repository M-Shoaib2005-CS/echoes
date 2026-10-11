import { defineEndpoint } from './_lib/http';
import { ApiError } from './_lib/http';
import { QlooError } from './_lib/qloo/client';
import { rankSearchResults } from './_lib/rank';
import { getRuntime, searchCap } from './_lib/runtime';
import { searchQuerySchema } from './_lib/schemas';

export default defineEndpoint({ method: 'GET', schema: searchQuerySchema, cap: searchCap }, async ({ q, domain }) => {
  try {
    const { items, source } = await getRuntime().qloo.search(q, domain);
    return { items: rankSearchResults(items, q).slice(0, 6), source };
  } catch (e) {
    if (e instanceof QlooError) {
      throw new ApiError(503, 'qloo_unavailable', 'Search is unavailable right now. Please try again in a moment, or open a ready-made session.');
    }
    throw e;
  }
});
