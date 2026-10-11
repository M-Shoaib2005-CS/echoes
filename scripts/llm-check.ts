// npm run llm-check: sends one tiny request to your configured LLM and prints the real error if it fails.
import { createLlm, LlmError, parseLlmJson } from '../api/_lib/llm';
import { loadDotEnv } from './env';

async function main() {
  loadDotEnv();
  console.log(`LLM_PROVIDER=${process.env.LLM_PROVIDER ?? '(default gemini)'}  LLM_MODEL=${process.env.LLM_MODEL || '(default)'}  key set: ${Boolean(process.env.LLM_API_KEY)}`);
  const llm = createLlm(process.env);
  if (!llm) {
    console.error('No LLM_API_KEY found. Put it in .env.local as LLM_API_KEY=... (no quotes, no spaces) in the project root.');
    process.exit(1);
  }
  try {
    const out = await llm.complete({ system: 'Reply with JSON only.', user: 'Return {"ok": true, "word": "hello"}', maxTokens: 200 });
    console.log('Raw reply:', out);
    console.log('Parsed:', parseLlmJson(out));
    console.log(`\nSUCCESS: ${llm.name} is working.`);
  } catch (e) {
    console.error('\nFAILED:', e instanceof LlmError ? e.message : e);
    console.error('\n400/403 = bad key or key restricted. 404 = model name not available (set LLM_MODEL). 429 = free quota used up. "request failed" = network or timeout.');
    process.exit(1);
  }
}
void main();
