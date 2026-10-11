import type { Domain } from './types';

export interface Persona {
  id: string;
  title: string;
  blurb: string;
  nickname: string;
  city: string;
  bornDecade: number;
  seeds: { name: string; domain: Domain }[];
}

/** Invented example people, mixing Western and South Asian tastes. Not real individuals. */
export const PERSONAS: Persona[] = [
  {
    id: 'nani-music',
    title: 'Nani, who sang along to everything',
    blurb: 'Ghazals and film songs from Lahore and Bombay, alongside crooners on the radio.',
    nickname: 'Nani',
    city: 'Lahore',
    bornDecade: 1940,
    seeds: [
      { name: 'Lata Mangeshkar', domain: 'artist' },
      { name: 'Noor Jahan', domain: 'artist' },
      { name: 'Mohammed Rafi', domain: 'artist' },
      { name: 'Frank Sinatra', domain: 'artist' },
      { name: 'Nat King Cole', domain: 'artist' },
    ],
  },
  {
    id: 'grandpa-film',
    title: 'Grandpa Joe, the film buff',
    blurb: 'Golden-age Hollywood, Mughal epics and Kurosawa, with a little jazz.',
    nickname: 'Grandpa Joe',
    city: 'London',
    bornDecade: 1930,
    seeds: [
      { name: 'Casablanca', domain: 'movie' },
      { name: 'Mughal-E-Azam', domain: 'movie' },
      { name: 'Seven Samurai', domain: 'movie' },
      { name: "Singin' in the Rain", domain: 'movie' },
      { name: 'Louis Armstrong', domain: 'artist' },
    ],
  },
  {
    id: 'rose-tv',
    title: 'Aunty Rose, TV and variety',
    blurb: 'Sitcoms, variety hours and the evening dramas the whole family watched together.',
    nickname: 'Aunty Rose',
    city: 'London',
    bornDecade: 1940,
    seeds: [
      { name: 'I Love Lucy', domain: 'tv_show' },
      { name: 'The Ed Sullivan Show', domain: 'tv_show' },
      { name: 'Dhoop Kinare', domain: 'tv_show' },
      { name: 'Alif Noon', domain: 'tv_show' },
      { name: 'Doris Day', domain: 'artist' },
    ],
  },
];
