import { politeFetch } from './http';

const ENDPOINT = 'https://query.wikidata.org/sparql';
/** Q3231690 = « modèle d'automobile » (voitures de série). */
const CAR_MODEL_CLASS = 'wd:Q3231690';
/** Q90834785 = « modèle d'automobile de course » (F1, endurance, rallye…), qui n'est pas une sous-classe du précédent. */
const RACING_MODEL_CLASS = 'wd:Q90834785';

export interface WikidataCar {
  qid: string;
  name: string;
  manufacturer: string | null;
  country: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  imageUrl: string | null;
  imageFile: string | null;
  racing: boolean;
  wikiTitle: string | null;
  wikiLang: string | null;
  powerKw: number | null;
  topSpeedKmh: number | null;
  massKg: number | null;
  lengthMm: number | null;
  popularity: number;
}

type Binding = Record<string, { type: string; value: string } | undefined>;
interface SparqlResult {
  results: { bindings: Binding[] };
}

async function sparql(query: string): Promise<Binding[]> {
  const res = await politeFetch(
    ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: new URLSearchParams({ query }).toString(),
    },
    // Le service de requêtes peut imposer de longues pauses (jusqu'à 1 requête/min en cas d'incident).
    { timeoutMs: 90_000, retries: 6, maxRetryAfterMs: 180_000 },
  );
  return ((await res.json()) as SparqlResult).results.bindings;
}

const qidOf = (uri: string) => uri.substring(uri.lastIndexOf('/') + 1);

function commonsThumb(url: string, width = 640): string {
  return `${url.replace(/^http:/, 'https:')}?width=${width}`;
}

/** « http://commons.wikimedia.org/wiki/Special:FilePath/Ferrari%20F40.jpg » → « Ferrari F40.jpg » */
export function commonsFileName(url: string): string {
  return decodeURIComponent(url.substring(url.lastIndexOf('/') + 1)).replace(/_/g, ' ');
}

function year(value?: string): number | null {
  if (!value) return null;
  const m = /^(-?\d{1,4})/.exec(value);
  return m ? Number.parseInt(m[1], 10) : null;
}

interface Candidate {
  qid: string;
  popularity: number;
  image: string | null;
  racing: boolean;
}

/** Modèles illustrés d'une famille (sans tri ni regroupement côté serveur : requête légère). */
async function listFamily(rootClass: string, minSitelinks: number) {
  return sparql(`
    SELECT ?car ?links ?img WHERE {
      ?class wdt:P279* ${rootClass} .
      ?car wdt:P31 ?class ;
           wikibase:sitelinks ?links ;
           wdt:P18 ?img .
      FILTER(?links >= ${minSitelinks})
    }`);
}

/** Étape 1 : voitures de série + voitures de course, triées par notoriété (nombre de wikis). */
async function listCandidates(limit: number, minSitelinks: number): Promise<Candidate[]> {
  const byQid = new Map<string, Candidate>();
  for (const [root, racing] of [
    [CAR_MODEL_CLASS, false],
    [RACING_MODEL_CLASS, true],
  ] as const) {
    for (const r of await listFamily(root, minSitelinks)) {
      if (!r.car || !r.links) continue;
      const qid = qidOf(r.car.value);
      const prev = byQid.get(qid);
      byQid.set(qid, {
        qid,
        popularity: Math.max(prev?.popularity ?? 0, Number(r.links.value)),
        image: prev?.image ?? r.img?.value ?? null,
        racing: (prev?.racing ?? false) || racing,
      });
    }
  }
  return [...byQid.values()].sort((a, b) => b.popularity - a.popularity).slice(0, limit);
}

/** Étape 2 : détails d'un lot de modèles. */
async function fetchDetails(qids: string[]) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  return sparql(`
    SELECT ?car ?frLabel ?enLabel ?brandFr ?brandEn ?mfrFr ?mfrEn ?countryFr ?countryEn ?makerCountryFr ?makerCountryEn
           ?start ?end ?power ?speed ?mass ?length ?frTitle ?enTitle WHERE {
      VALUES ?car { ${values} }
      OPTIONAL { ?car rdfs:label ?frLabel FILTER(LANG(?frLabel) = "fr") }
      OPTIONAL { ?car rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
      OPTIONAL {
        ?car wdt:P1716 ?brand .
        OPTIONAL { ?brand rdfs:label ?brandFr FILTER(LANG(?brandFr) = "fr") }
        OPTIONAL { ?brand rdfs:label ?brandEn FILTER(LANG(?brandEn) = "en") }
      }
      OPTIONAL {
        ?car wdt:P176 ?mfr .
        OPTIONAL { ?mfr rdfs:label ?mfrFr FILTER(LANG(?mfrFr) = "fr") }
        OPTIONAL { ?mfr rdfs:label ?mfrEn FILTER(LANG(?mfrEn) = "en") }
      }
      OPTIONAL {
        ?car wdt:P495 ?country .
        OPTIONAL { ?country rdfs:label ?countryFr FILTER(LANG(?countryFr) = "fr") }
        OPTIONAL { ?country rdfs:label ?countryEn FILTER(LANG(?countryEn) = "en") }
      }
      OPTIONAL {
        ?car (wdt:P1716|wdt:P176)/wdt:P17 ?makerCountry .
        OPTIONAL { ?makerCountry rdfs:label ?makerCountryFr FILTER(LANG(?makerCountryFr) = "fr") }
        OPTIONAL { ?makerCountry rdfs:label ?makerCountryEn FILTER(LANG(?makerCountryEn) = "en") }
      }
      # Début : début, création, commercialisation, mise en service, présentation
      OPTIONAL { ?car wdt:P580|wdt:P571|wdt:P5204|wdt:P729|wdt:P577 ?start }
      # Fin : fin, arrêt de production, dissolution, retrait du service
      OPTIONAL { ?car wdt:P582|wdt:P2669|wdt:P576|wdt:P730 ?end }
      OPTIONAL { ?car p:P2109/psn:P2109/wikibase:quantityAmount ?power }
      OPTIONAL { ?car p:P2052/psn:P2052/wikibase:quantityAmount ?speed }
      OPTIONAL { ?car p:P2067/psn:P2067/wikibase:quantityAmount ?mass }
      OPTIONAL { ?car p:P2043/psn:P2043/wikibase:quantityAmount ?length }
      OPTIONAL { ?fr schema:about ?car ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?frTitle }
      OPTIONAL { ?en schema:about ?car ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle }
    }`);
}

function aggregate(
  qid: string,
  rows: Binding[],
  popularity: number,
  image: string | null,
  racing: boolean,
): WikidataCar | null {
  const first = (key: string) => rows.find((r) => r[key]?.value)?.[key]?.value ?? null;
  const nums = (key: string) =>
    rows.map((r) => Number(r[key]?.value)).filter((n) => Number.isFinite(n) && n > 0);

  const name = first('frLabel') ?? first('enLabel');
  if (!name || /^Q\d+$/.test(name)) return null;

  const starts = rows.map((r) => year(r.start?.value)).filter((y): y is number => y !== null);
  const ends = rows.map((r) => year(r.end?.value)).filter((y): y is number => y !== null);
  const powers = nums('power'); // watts (unité normalisée)
  const speeds = nums('speed'); // m/s
  const masses = nums('mass'); // kg
  const lengths = nums('length'); // m

  const frTitle = first('frTitle');
  const enTitle = first('enTitle');
  const yearStart = starts.length ? Math.min(...starts) : null;
  const yearEnd = ends.length ? Math.max(...ends) : null;

  return {
    qid,
    name,
    manufacturer: first('brandFr') ?? first('brandEn') ?? first('mfrFr') ?? first('mfrEn'),
    country: first('countryFr') ?? first('countryEn') ?? first('makerCountryFr') ?? first('makerCountryEn'),
    yearStart: yearStart && yearStart > 1850 && yearStart < 2100 ? yearStart : null,
    yearEnd: yearEnd && yearEnd > 1850 && yearEnd < 2100 ? yearEnd : null,
    imageUrl: image ? commonsThumb(image) : null,
    imageFile: image ? commonsFileName(image) : null,
    racing,
    wikiTitle: frTitle ?? enTitle,
    wikiLang: frTitle ? 'fr' : enTitle ? 'en' : null,
    powerKw: powers.length ? Math.max(...powers) / 1000 : null,
    topSpeedKmh: speeds.length ? Math.max(...speeds) * 3.6 : null,
    massKg: masses.length ? Math.min(...masses) : null,
    lengthMm: (() => {
      const l = lengths.filter((m) => m > 1.5 && m < 30);
      return l.length ? Math.round(Math.max(...l) * 1000) : null;
    })(),
    popularity,
  };
}

export interface FetchOptions {
  limit: number;
  minSitelinks?: number;
  batchSize?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Récupère le catalogue de voitures depuis Wikidata. */
export async function fetchWikidataCars(opts: FetchOptions): Promise<WikidataCar[]> {
  const candidates = await listCandidates(opts.limit, opts.minSitelinks ?? 3);
  const batchSize = opts.batchSize ?? 50;
  const cars: WikidataCar[] = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const rows = await fetchDetails(batch.map((c) => c.qid));
    const byQid = new Map<string, Binding[]>();
    for (const row of rows) {
      const qid = qidOf(row.car!.value);
      byQid.set(qid, [...(byQid.get(qid) ?? []), row]);
    }
    for (const c of batch) {
      const car = aggregate(c.qid, byQid.get(c.qid) ?? [], c.popularity, c.image, c.racing);
      if (car) cars.push(car);
    }
    opts.onProgress?.(Math.min(i + batchSize, candidates.length), candidates.length);
  }
  return cars;
}
