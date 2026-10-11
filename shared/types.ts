export const DOMAINS = ['artist', 'movie', 'tv_show'] as const;
export type Domain = (typeof DOMAINS)[number];
export type ItemDomain = Domain | 'place';
export const DOMAIN_LABEL: Record<ItemDomain, string> = {
  artist: 'Music',
  movie: 'Film',
  tv_show: 'TV',
  place: 'Outing',
};

/** The only shape the rest of the app knows. Qloo field names stop at normalize.ts. */
export interface Item {
  id: string;
  name: string;
  domain: ItemDomain;
  affinity?: number;
  popularity?: number;
  tags?: string[];
  year?: number;
  imageUrl?: string;
  reasons?: string[];
}
export interface Seed {
  id: string;
  name: string;
  domain: Domain;
}
export type Rating = 'loved' | 'neutral' | 'upset';
export type DataMode = 'live' | 'recorded' | 'mock';
export interface DataSource {
  mode: DataMode;
  recordedAt?: string;
}
export type IdSpace = 'mock' | 'qloo';

export interface Feedback {
  loved: Seed[];
  upsetIds: string[];
}
export interface SessionRequest {
  nickname: string;
  city?: string;
  bornDecade?: number;
  seeds: Seed[];
  feedback?: Feedback;
}

export interface PlanItem {
  id: string;
  prompt: string;
  sensoryCue: string;
}
export interface PlanSegment {
  domain: Domain;
  title: string;
  intro: string;
  minutes: number;
  items: PlanItem[];
}
export interface SessionPlan {
  title: string;
  warmup: { text: string; minutes: number };
  segments: PlanSegment[];
  winddown: { text: string; minutes: number };
  outing?: { id: string; prompt: string };
}
export type PlanSource = 'llm' | 'template';
export interface YearFilter {
  active: boolean;
  note: string;
}
export interface TagInfo {
  id: string;
  name: string;
  type?: string;
}
export type AgentToolName = 'find_entity' | 'find_tags' | 'recommend' | 'finish';
export interface AgentStep {
  n: number;
  tool: AgentToolName | 'error';
  thought: string;
  input: string;
  output: string;
  ms: number;
}
export interface AgentRun {
  instruction: string;
  steps: AgentStep[];
  finishedBy: 'agent' | 'step_limit' | 'time_limit' | 'error';
  llmCalls: number;
  qlooCalls: number;
}
export interface SessionResponse {
  items: Item[];
  outings: Item[];
  plan: SessionPlan;
  planSource: PlanSource;
  source: DataSource;
  notices: string[];
  yearFilter: YearFilter;
  /** Present when the session was shaped by the agent; lists every tool call it made. */
  agent?: AgentRun;
}
export interface Changes {
  added: Item[];
  removed: Item[];
  upsetRemoved: Item[];
  drivers: Record<string, string[]>;
}

export interface LlmOnlyItem {
  name: string;
  domain: Domain;
  why?: string;
}
export type CompareStatus = 'in-shown' | 'in-qloo' | 'in-catalogue' | 'not-found' | 'unchecked' | 'seed';
export interface CompareRow extends LlmOnlyItem {
  status: CompareStatus;
}
export interface CompareStats {
  llmTotal: number;
  inQlooResults: number;
  overlapShown: number;
  notFound: number;
  qlooShown: number;
  qlooUnique: number;
  qlooWithReasons: number;
  /** In Qloo's catalogue but not recommended for these favourites. Absent in older saved results. */
  inCatalogue?: number;
  /** Not checked against Qloo's catalogue (for example when replaying recorded data). */
  unchecked?: number;
}
export type CompareVerdict = 'similar' | 'mixed' | 'different';
export interface CompareResult {
  rows: CompareRow[];
  llmSource: 'llm' | 'sample';
  stats: CompareStats;
  qlooOnly: Item[];
  verdict: CompareVerdict;
  summary: string;
  source: DataSource;
}

export interface PresetBundle {
  id: string;
  title: string;
  blurb: string;
  nickname: string;
  city?: string;
  bornDecade?: number;
  seeds: Seed[];
  response: SessionResponse;
  compare: CompareResult | null;
  idSpace: IdSpace;
  generatedAt: string;
}
export interface HealthInfo {
  ok: boolean;
  mode: DataMode;
  idSpace: IdSpace;
  llm: string | null;
  /** True when the agent (Ask Echoes) can run: it needs an LLM. */
  agent: boolean;
  hasRecorded: boolean;
  budget: { used: number; limit: number };
}
