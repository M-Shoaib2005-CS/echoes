import type { PresetBundle } from '../../shared/types';
import generated from './presets.generated.json';

/** Pre-generated sessions: opening one makes zero API calls. Rebuild with `npm run presets`. */
export const PRESETS = generated as unknown as PresetBundle[];
