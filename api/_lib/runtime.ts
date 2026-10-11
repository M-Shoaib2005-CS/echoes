import { createLlm, type LlmProvider } from './llm';
import { IpCap, positiveInt } from './limiter';
import { createQlooSource, sourceOptionsFromEnv, type QlooSource } from './qloo/source';

export interface Runtime {
  qloo: QlooSource;
  llm: LlmProvider | null;
}
let runtime: Runtime | undefined;

/** Built once per warm serverless instance. */
export function getRuntime(): Runtime {
  runtime ??= { qloo: createQlooSource(sourceOptionsFromEnv(process.env)), llm: createLlm(process.env) };
  return runtime;
}

export const sessionCap = new IpCap(positiveInt(process.env.RATE_LIMIT_PER_MIN, 20), 60_000);
export const searchCap = new IpCap(60, 60_000);
