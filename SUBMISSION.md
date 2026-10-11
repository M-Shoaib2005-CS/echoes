# Echoes: submission text

## Description (about 340 words)

Echoes is an agent that plans gentle reminiscence sessions for people living with dementia or memory loss. Familiar music, film and TV start warm conversations, but preparing them takes time caregivers rarely have.

A caregiver enters a nickname and three to six favourites. Echoes builds a 30-minute session: a warm-up, music, film and TV segments with a conversation prompt and sensory cue for each item ("hum along"), and a calm wind-down. The caregiver then taps loved, neutral or upset on each item, and the next session adapts.

**Ask Echoes is the agent.** The caregiver types a request, for example "she loved Sunday-evening ghazal radio, make it gentler". An AI agent decides which Qloo tools to call: look up an entity, search tags, or request recommendations filtered by tag and era. It then picks the final items, and every step is shown ("What Echoes did"). Code enforces the guardrails: the agent can only choose ids Qloo returned, it is capped at six steps, and if it cannot finish, the standard session is used.

**What makes it Qloo-powered.** Every recommendation, its ranking and its "because of" reason comes from Qloo: insights seeded with the favourites, explainability, a hard tag filter, an era window around the person's teens and twenties, and exclusions for anything that upset them. Loved items feed the next round. The language model never invents titles; it only chooses among Qloo's results and words the plan.

**With Qloo vs without** tests this. It asks the same model the same question without Qloo data, then counts in code how many of its titles appear in Qloo's results, which exist in Qloo's catalogue but were not recommended, and which carry an explanation. If the lists look similar, it says so.

Qloo describes what groups with similar tastes tend to like, so Echoes offers a familiar neighbourhood to try, and the caregiver's ratings decide what stays. It is not medical software and makes no health claims. Qloo receives only public entity ids and an optional city.

Families start free; care homes, who run these sessions daily, are the natural paying customers.

## How to try it in 60 seconds

1. Open the live demo and choose a ready-made persona (instant, no waiting).
2. Tap **Loved it** on two items and **Upset** on one, then tap **Next session** and read **What changed since last session**.
3. Open **Ask Echoes**, tap an example such as "Add more ghazal and classic Urdu music", and read **What Echoes did**.
4. Open **With Qloo vs without** and generate the AI-only list.
5. On a phone, try **Go one by one** (focus mode), the **Aa** text-size button, and **Print sheet**.

## Qloo and AI calls per action

| Action | Qloo calls | LLM calls |
|---|---|---|
| Open a ready-made persona | 0 | 0 |
| Autocomplete search (debounced) | 1 per search | 0 |
| First session (3 domains + 1 outing if a city is given) | 3 to 4 | 1 (retry once on failure) |
| Next session with feedback | 3 to 4 | 1 |
| Ask Echoes (agent run, up to 6 steps) | 1 to 8 | 2 to 7 |
| With Qloo vs without | 0 to 4 plus up to about 10 catalogue searches (cached) | 1 |
| Repeat of an identical request | 0 (cache) | 0 (cache) |

## Devpost / Qloo submission guide checklist

Qloo's kit (`docs/SUBMISSION.md`) asks for six things. Where each lives:

1. **Problem statement**: first paragraph of the description above.
2. **Qloo workflow used and why.** Echoes calls Qloo's REST API directly from its own serverless functions, and the key never reaches the browser.
   - `GET /search` (`query`, `types`, `take`) resolves a typed favourite to an entity id. Autocomplete uses it, ranked so exact matches come before collaboration entries.
   - `GET /v2/insights` is the core call, made once per domain (artist, film, TV) with `filter.type`, `signal.interests.entities` (comma-separated favourite ids, later also loved items), `filter.exclude.entities` (items marked "upset", permanently), `feature.explainability=true` and `take`. A fourth call with `filter.location.query` finds a local outing.
   - Why insights: the question is "what else would someone with these tastes enjoy, across music, film and TV?", which is Qloo's cross-domain affinity. Explainability (`query.explainability["signal.interests.entities"]`) supplies the "because of" reasons.
   - Also used: `GET /v2/tags` was exercised in the smoke test. Confirmed against the live API: the era parameters `filter.release_year.min/max` (for the same favourites, films moved from 1994-2016 to 1950-1975) and `filter.tags` as a hard tag filter (the ghazal tag returned Begum Akhtar, Talat Aziz and Iqbal Bano). The app re-checks years in code either way.
3. **Redacted request-to-result example** (real response, 4 favourites: Frank Sinatra, I Love Lucy, Casablanca, Lata Mangeshkar; entity ids shortened, no key):
   ```
   GET /v2/insights?filter.type=urn:entity:artist
       &signal.interests.entities=FC0F8D26...,65E28499...,11FB3D67...,D32E8668...
       &feature.explainability=true&take=10
   ```
   | Result | Affinity | Qloo's explanation (top contributing favourites) |
   |---|---|---|
   | Louis Armstrong | 0.96 | Frank Sinatra, I Love Lucy |
   | Nat King Cole | 0.96 | Frank Sinatra, I Love Lucy |
   | Peggy Lee | 0.95 | I Love Lucy, Frank Sinatra |

   Same favourites, `filter.type=urn:entity:movie`: Life Is Beautiful (1997, 0.91, because of Casablanca and Frank Sinatra), Forrest Gump (1994), Good Will Hunting (1997). This showed that, left alone, Qloo's film and TV picks skew modern, so Echoes adds an era window of roughly ages 10 to 30 (the "reminiscence bump") for the person's birth decade. Entity choice: always the exact-name match from `/search`, never a guess.
4. **Demo or screenshots**: use a ready-made persona. Do not show `.env`, the Vercel env page or any key on screen or in a recording.
5. **Setup from a clean environment**: see README (`npm install`, `.env.local`, `npm run dev`, then `scripts/POST_KEY_CHECKLIST.md`).
6. **Known limitations and what the results do not establish**: see the README sections of those names. In short: Qloo results describe group tendencies, not one person, and the app makes no health claims.

## Problem space and research (optional extra text for the form)

Echoes is designed around how reminiscence work is actually done. Research on the "reminiscence bump" found that music is best recalled from roughly ages 13 to 19, and established programmes such as Music & Memory pick songs from the listener's ages 15 to 25. Existing tools such as Music & Memory's playlist app, Music for my Mind's Playlist Maker and Playlist for Life's app build music playlists from decade and genre questions on top of Spotify. Echoes differs in three ways: it works across music, film and TV from a few mixed favourites (including South Asian and other non-Western tastes), it explains each suggestion, and it adapts after every session from the caregiver's reactions. Qloo's cross-domain taste graph is what makes the first two possible.
