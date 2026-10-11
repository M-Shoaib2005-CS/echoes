// Hand-written SAMPLE data in the *assumed* Qloo response format, for development before a key exists.
// It is not Qloo data and the UI labels it as such. TODO(verify): real shapes differ in places.
import { normName } from '../../../shared/text';
import type { Domain, ItemDomain } from '../../../shared/types';
import type { InsightsParams } from './client';

type Cat = [domain: Domain, name: string, year: number, tags: string[]];
const T = (s: string) => s.split(' ');

const CATALOGUE: Cat[] = [
  ['artist', 'Frank Sinatra', 1943, T('crooner-standards swing romance')],
  ['artist', 'Nat King Cole', 1944, T('crooner-standards jazz-blues romance')],
  ['artist', 'Ella Fitzgerald', 1935, T('jazz-blues crooner-standards')],
  ['artist', 'Louis Armstrong', 1925, T('jazz-blues swing')],
  ['artist', 'Vera Lynn', 1935, T('wartime-nostalgia british-classic')],
  ['artist', 'Doris Day', 1947, T('crooner-standards musical romance')],
  ['artist', 'Dean Martin', 1946, T('crooner-standards comedy swing')],
  ['artist', 'Bing Crosby', 1926, T('crooner-standards musical wartime-nostalgia')],
  ['artist', 'Elvis Presley', 1954, T('rock-n-roll romance')],
  ['artist', 'Patsy Cline', 1955, T('folk-roots romance')],
  ['artist', 'Lata Mangeshkar', 1942, T('bollywood-classic romance musical')],
  ['artist', 'Mohammed Rafi', 1944, T('bollywood-classic romance')],
  ['artist', 'Kishore Kumar', 1946, T('bollywood-classic comedy')],
  ['artist', 'Asha Bhosle', 1943, T('bollywood-classic musical')],
  ['artist', 'Noor Jahan', 1935, T('urdu-classic bollywood-classic romance')],
  ['artist', 'Mehdi Hassan', 1952, T('ghazal-qawwali urdu-classic')],
  ['artist', 'Nusrat Fateh Ali Khan', 1965, T('ghazal-qawwali folk-roots')],
  ['artist', 'Begum Akhtar', 1930, T('ghazal-qawwali urdu-classic')],
  ['artist', 'Ghulam Ali', 1960, T('ghazal-qawwali urdu-classic')],
  ['artist', 'Abida Parveen', 1973, T('ghazal-qawwali folk-roots')],
  ['artist', 'Runa Laila', 1966, T('urdu-classic ghazal-qawwali')],
  ['artist', 'Umm Kulthum', 1920, T('world-classic romance')],
  ['artist', 'Fairuz', 1950, T('world-classic romance')],
  ['artist', 'Edith Piaf', 1935, T('world-classic romance wartime-nostalgia')],
  ['artist', 'Mahalia Jackson', 1931, T('gospel-soul')],
  ['artist', 'Sam Cooke', 1951, T('gospel-soul romance rock-n-roll')],
  ['artist', 'Glenn Miller', 1938, T('swing wartime-nostalgia jazz-blues')],
  ['artist', 'Duke Ellington', 1923, T('jazz-blues swing')],
  ['movie', 'Casablanca', 1942, T('golden-age-hollywood romance wartime-nostalgia')],
  ['movie', "Singin' in the Rain", 1952, T('golden-age-hollywood musical comedy')],
  ['movie', 'Roman Holiday', 1953, T('golden-age-hollywood romance comedy')],
  ['movie', 'Some Like It Hot', 1959, T('golden-age-hollywood comedy')],
  ['movie', 'The Sound of Music', 1965, T('musical family-drama wartime-nostalgia')],
  ["movie", "It's a Wonderful Life", 1946, T('golden-age-hollywood family-drama')],
  ['movie', 'Gone with the Wind', 1939, T('epic-drama romance golden-age-hollywood')],
  ['movie', 'Mughal-E-Azam', 1960, T('bollywood-classic epic-drama romance urdu-classic')],
  ['movie', 'Sholay', 1975, T('bollywood-classic epic-drama comedy')],
  ['movie', 'Mother India', 1957, T('bollywood-classic family-drama epic-drama')],
  ['movie', 'Pyaasa', 1957, T('bollywood-classic romance')],
  ['movie', 'Awara', 1951, T('bollywood-classic romance musical')],
  ['movie', 'Anarkali', 1958, T('urdu-classic romance epic-drama')],
  ['movie', 'Heer Ranjha', 1970, T('urdu-classic romance folk-roots musical')],
  ['movie', 'Jago Hua Savera', 1959, T('world-cinema urdu-classic family-drama')],
  ['movie', 'Seven Samurai', 1954, T('world-cinema epic-drama')],
  ['movie', 'Pather Panchali', 1955, T('world-cinema family-drama')],
  ['movie', 'Cinema Paradiso', 1988, T('world-cinema romance family-drama')],
  ['movie', 'The Third Man', 1949, T('british-classic wartime-nostalgia')],
  ['movie', 'Brief Encounter', 1945, T('british-classic romance wartime-nostalgia')],
  ['movie', 'Ben-Hur', 1959, T('epic-drama golden-age-hollywood')],
  ['movie', 'My Fair Lady', 1964, T('musical romance british-classic')],
  ['movie', 'Lawrence of Arabia', 1962, T('epic-drama british-classic')],
  ['tv_show', 'I Love Lucy', 1951, T('tv-sitcom comedy variety-show')],
  ['tv_show', 'The Ed Sullivan Show', 1948, T('variety-show musical')],
  ['tv_show', 'The Dick Van Dyke Show', 1961, T('tv-sitcom comedy')],
  ['tv_show', 'Fawlty Towers', 1975, T('british-classic tv-sitcom comedy')],
  ['tv_show', "Dad's Army", 1968, T('british-classic wartime-nostalgia comedy')],
  ['tv_show', 'Mind Your Language', 1977, T('british-classic tv-sitcom comedy')],
  ['tv_show', 'Downton Abbey', 2010, T('british-classic family-drama')],
  ['tv_show', 'Bonanza', 1959, T('family-drama epic-drama')],
  ['tv_show', 'The Lawrence Welk Show', 1955, T('variety-show musical swing')],
  ['tv_show', 'Dhoop Kinare', 1987, T('urdu-classic romance family-drama')],
  ['tv_show', 'Ankahi', 1982, T('urdu-classic family-drama romance')],
  ['tv_show', 'Alif Noon', 1965, T('urdu-classic comedy variety-show')],
  ['tv_show', 'Tanhaiyan', 1985, T('urdu-classic family-drama comedy')],
  ['tv_show', 'Fifty Fifty', 1979, T('urdu-classic comedy variety-show')],
  ['tv_show', 'Waris', 1979, T('urdu-classic epic-drama family-drama')],
  ['tv_show', 'Hum Log', 1984, T('bollywood-classic family-drama')],
  ['tv_show', 'Malgudi Days', 1986, T('world-cinema family-drama')],
  ['tv_show', 'Buniyaad', 1986, T('family-drama epic-drama bollywood-classic')],
  ['tv_show', 'Mahabharat', 1988, T('epic-drama bollywood-classic')],
  ['tv_show', 'Chitrahaar', 1982, T('variety-show bollywood-classic musical')],
  ['tv_show', 'Ramayan', 1987, T('epic-drama bollywood-classic')],
  ['tv_show', 'Neelam Ghar', 1972, T('variety-show urdu-classic')],
];

const PLACES: Record<string, string[]> = {
  lahore: ['Lahore Museum', 'Shalimar Gardens', 'Alhamra Arts Council'],
  london: ['Royal Albert Hall', 'Kew Gardens', 'Museum of London'],
};

const TAG_NAMES = [...new Set(CATALOGUE.flatMap((c) => c[3]))];
const tagLabel = (t: string) => t.split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
const stripTag = (id: string) => id.replace('mock-tag:', '');

export function mockTagsRaw(query: string): unknown {
  const q = normName(query);
  const words = q.split(' ').filter((w) => w.length > 3);
  const tags = TAG_NAMES.filter((t) => normName(t.replace(/-/g, ' ')).includes(q) || words.some((w) => t.includes(w)))
    .slice(0, 5)
    .map((t) => ({ id: `mock-tag:${t}`, name: tagLabel(t), type: 'urn:tag:genre:mock' }));
  return { success: true, results: { tags } };
}

const slug = (s: string) => normName(s).replace(/ /g, '-');
const idOf = (d: ItemDomain, name: string) => `mock:${d}:${slug(name)}`;
const popularity = (name: string) => 0.2 + ((name.length * 37 + name.charCodeAt(0) * 11) % 70) / 100;

const rawEntity = ([domain, name, year, tags]: Cat) => ({
  entity_id: idOf(domain, name),
  name,
  type: `urn:entity:${domain}`,
  popularity: popularity(name),
  properties: { release_year: year },
  tags: tags.map((t) => ({ name: t, tag_id: `mock-tag:${t}` })),
});

export function mockSearchRaw(query: string, domain?: Domain): unknown {
  const needle = normName(query);
  const entities = CATALOGUE.filter((c) => (!domain || c[0] === domain) && normName(c[1]).includes(needle))
    .slice(0, 8)
    .map(rawEntity);
  return { success: true, results: entities };
}

export function mockInsightsRaw(p: InsightsParams): unknown {
  if (p.domain === 'place') {
    const names = PLACES[(p.city ?? '').trim().toLowerCase()] ?? [];
    const entities = names.slice(0, p.take).map((name) => ({
      entity_id: idOf('place', name),
      name,
      type: 'urn:entity:place',
      popularity: popularity(name),
      properties: { address: p.city },
    }));
    return { success: true, results: { entities } };
  }
  const seeds = p.signalIds.map((id) => CATALOGUE.find((c) => idOf(c[0], c[1]) === id)).filter((c): c is Cat => !!c);
  const tagWeight = new Map<string, number>();
  for (const s of seeds) for (const t of s[3]) tagWeight.set(t, (tagWeight.get(t) ?? 0) + 1);
  for (const id of p.signalTagIds ?? []) tagWeight.set(stripTag(id), (tagWeight.get(stripTag(id)) ?? 0) + 2);
  const mustHave = (p.tagIds ?? []).map(stripTag);
  const excluded = new Set(p.excludeIds);

  const scored = CATALOGUE.filter((c) => c[0] === p.domain && !excluded.has(idOf(c[0], c[1])) && (!mustHave.length || mustHave.some((t) => c[3].includes(t))))
    .map((c) => {
      const overlap = c[3].reduce((n, t) => n + (tagWeight.get(t) ?? 0), 0);
      const because = seeds.filter((s) => s[3].some((t) => c[3].includes(t)));
      return { c, overlap, because };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, p.take);

  const entities = scored.map(({ c, overlap, because }) => ({
    ...rawEntity(c),
    query: {
      affinity: Math.round((0.4 + 0.58 * Math.min(1, overlap / (Math.max(1, seeds.length + (p.signalTagIds?.length ?? 0)) * 3))) * 100) / 100,
      explainability: because.slice(0, 2).map((s) => ({ entity_id: idOf(s[0], s[1]), name: s[1] })),
    },
  }));
  return { success: true, results: { entities } };
}
