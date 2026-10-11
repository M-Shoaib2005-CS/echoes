import type { LlmOnlyItem } from '../shared/types';

/**
 * Illustrative lists for the preset compare view when no LLM key is available at build time.
 * Hand-written to look like typical AI-only suggestions. They are NOT live AI output and the
 * UI says so. Replaced by real output when `npm run presets` runs with LLM_API_KEY set.
 */
const a = (name: string): LlmOnlyItem => ({ name, domain: 'artist' });
const m = (name: string): LlmOnlyItem => ({ name, domain: 'movie' });
const t = (name: string): LlmOnlyItem => ({ name, domain: 'tv_show' });

export const SAMPLE_LLM_ONLY: Record<string, LlmOnlyItem[]> = {
  'nani-music': [a('Ella Fitzgerald'), a('Mehdi Hassan'), a('Elvis Presley'), a('Kishore Kumar'), a('Billie Holiday'), m('Mughal-E-Azam'), m('Roman Holiday'), m('Pakeezah'), m('Casablanca'), m('Mother India'), t('Dhoop Kinare'), t('I Love Lucy'), t('Ankahi'), t('Downton Abbey'), t('Chitrahaar')],
  'grandpa-film': [a('Duke Ellington'), a('Nat King Cole'), a('Frank Sinatra'), a('Ella Fitzgerald'), a('Billie Holiday'), m('Gone with the Wind'), m('Roman Holiday'), m('The Godfather'), m('Pather Panchali'), m('Ben-Hur'), t('Perry Mason'), t('The Twilight Zone'), t('Fawlty Towers'), t('Bonanza'), t('Doordarshan Chitrahaar')],
  'rose-tv': [a('Frank Sinatra'), a('Nat King Cole'), a('Lata Mangeshkar'), a('Elvis Presley'), a('Dean Martin'), m('Singin\u2019 in the Rain'), m('Roman Holiday'), m('Mughal-E-Azam'), m('Some Like It Hot'), m('The Sound of Music'), t('The Dick Van Dyke Show'), t('Ankahi'), t('Fifty Fifty'), t('Bewitched'), t('Waris')],
};
