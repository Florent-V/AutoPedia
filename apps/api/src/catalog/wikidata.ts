import { fetchJson } from './http';

const ENDPOINT = 'https://query.wikidata.org/sparql';
/** Q3231690 = « modèle d'automobile ». */
const CAR_MODEL_CLASS = 'wd:Q3231690';

export interface WikidataCar {
  qid: string;
  name: string;
  manufacturer: string | null;
  country: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  imageUrl: string | null;
  wikiTitle: string | null;
  wikiLang: string | null;
  powerKw: number | null;
  topSpeedKmh: number | null;
  massKg: number | null;
  popularity: number;
}

type Binding = Record<string, { type: string; value: string } | undefined>;
interface SparqlResult {
  results: { bindings: Binding[] };
}

async function sparql(query: string): Promise<Binding[]> {
  const res = await fetchJson<SparqlResult>(
    ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: new URLSearchParams({ query }).toString(),
    },
    90_000,
  );
  return res.results.bindings;
}

const qidOf = (uri: string) => uri.substring(uri.lastIndexOf('/') + 1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function commonsThumb(url: string, width = 640): string {
  return `${url.replace(/^http:/, 'https:')}?width=${width}`;
}

function year(value?: string): number | null {
  if (!value) return null;
  const m = /^(-?\d{1,4})/.exec(value);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** Étape 1 : liste des modèles illustrés, triés par notoriété (nombre de wikis). */
async function listCandidates(limit: number, minSitelinks: number) {
  const rows = await sparql(`
    SELECT ?car (MAX(?links) AS ?sitelinks) (SAMPLE(?img) AS ?image) WHERE {
      ?car wdt:P31/wdt:P279* ${CAR_MODEL_CLASS} ;
           wikibase:sitelinks ?links ;
           wdt:P18 ?img .
      FILTER(?links >= ${minSitelinks})
    }
    GROUP BY ?car
    ORDER BY DESC(?sitelinks)
    LIMIT ${limit}`);
  return rows
    .filter((r) => r.car && r.sitelinks)
    .map((r) => ({
      qid: qidOf(r.car!.value),
      popularity: Number(r.sitelinks!.value),
      image: r.image?.value ?? null,
    }));
}

/** Étape 2 : détails d'un lot de modèles. */
async function fetchDetails(qids: string[]) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  return sparql(`
    SELECT ?car ?frLabel ?enLabel ?mfrFr ?mfrEn ?countryFr ?countryEn ?mfrCountryFr ?mfrCountryEn
           ?start ?inception ?end ?power ?speed ?mass ?frTitle ?enTitle WHERE {
      VALUES ?car { ${values} }
      OPTIONAL { ?car rdfs:label ?frLabel FILTER(LANG(?frLabel) = "fr") }
      OPTIONAL { ?car rdfs:label ?enLabel FILTER(LANG(?enLabel) = "en") }
      OPTIONAL {
        ?car wdt:P176 ?mfr .
        OPTIONAL { ?mfr rdfs:label ?mfrFr FILTER(LANG(?mfrFr) = "fr") }
        OPTIONAL { ?mfr rdfs:label ?mfrEn FILTER(LANG(?mfrEn) = "en") }
        OPTIONAL {
          ?mfr wdt:P17 ?mfrCountry .
          OPTIONAL { ?mfrCountry rdfs:label ?mfrCountryFr FILTER(LANG(?mfrCountryFr) = "fr") }
          OPTIONAL { ?mfrCountry rdfs:label ?mfrCountryEn FILTER(LANG(?mfrCountryEn) = "en") }
        }
      }
      OPTIONAL {
        ?car wdt:P495 ?country .
        OPTIONAL { ?country rdfs:label ?countryFr FILTER(LANG(?countryFr) = "fr") }
        OPTIONAL { ?country rdfs:label ?countryEn FILTER(LANG(?countryEn) = "en") }
      }
      OPTIONAL { ?car wdt:P580 ?start }
      OPTIONAL { ?car wdt:P571 ?inception }
      OPTIONAL { ?car wdt:P582|wdt:P2669|wdt:P576 ?end }
      OPTIONAL { ?car p:P2109/psn:P2109/wikibase:quantityAmount ?power }
      OPTIONAL { ?car p:P2052/psn:P2052/wikibase:quantityAmount ?speed }
      OPTIONAL { ?car p:P2067/psn:P2067/wikibase:quantityAmount ?mass }
      OPTIONAL { ?fr schema:about ?car ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?frTitle }
      OPTIONAL { ?en schema:about ?car ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enTitle }
    }`);
}

function aggregate(qid: string, rows: Binding[], popularity: number, image: string | null): WikidataCar | null {
  const first = (key: string) => rows.find((r) => r[key]?.value)?.[key]?.value ?? null;
  const nums = (key: string) =>
    rows.map((r) => Number(r[key]?.value)).filter((n) => Number.isFinite(n) && n > 0);

  const name = first('frLabel') ?? first('enLabel');
  if (!name || /^Q\d+$/.test(name)) return null;

  const starts = rows.map((r) => year(r.start?.value) ?? year(r.inception?.value)).filter((y): y is number => y !== null);
  const ends = rows.map((r) => year(r.end?.value)).filter((y): y is number => y !== null);
  const powers = nums('power'); // watts (unité normalisée)
  const speeds = nums('speed'); // m/s
  const masses = nums('mass'); // kg

  const frTitle = first('frTitle');
  const enTitle = first('enTitle');
  const yearStart = starts.length ? Math.min(...starts) : null;
  const yearEnd = ends.length ? Math.max(...ends) : null;

  return {
    qid,
    name,
    manufacturer: first('mfrFr') ?? first('mfrEn'),
    country: first('countryFr') ?? first('countryEn') ?? first('mfrCountryFr') ?? first('mfrCountryEn'),
    yearStart: yearStart && yearStart > 1850 && yearStart < 2100 ? yearStart : null,
    yearEnd: yearEnd && yearEnd > 1850 && yearEnd < 2100 ? yearEnd : null,
    imageUrl: image ? commonsThumb(image) : null,
    wikiTitle: frTitle ?? enTitle,
    wikiLang: frTitle ? 'fr' : enTitle ? 'en' : null,
    powerKw: powers.length ? Math.max(...powers) / 1000 : null,
    topSpeedKmh: speeds.length ? Math.max(...speeds) * 3.6 : null,
    massKg: masses.length ? Math.min(...masses) : null,
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
  const batchSize = opts.batchSize ?? 80;
  const cars: WikidataCar[] = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    let rows: Binding[] = [];
    for (let attempt = 1; ; attempt++) {
      try {
        rows = await fetchDetails(batch.map((c) => c.qid));
        break;
      } catch (err) {
        if (attempt >= 3) throw err;
        await sleep(2000 * attempt);
      }
    }
    const byQid = new Map<string, Binding[]>();
    for (const row of rows) {
      const qid = qidOf(row.car!.value);
      byQid.set(qid, [...(byQid.get(qid) ?? []), row]);
    }
    for (const c of batch) {
      const car = aggregate(c.qid, byQid.get(c.qid) ?? [], c.popularity, c.image);
      if (car) cars.push(car);
    }
    opts.onProgress?.(Math.min(i + batchSize, candidates.length), candidates.length);
    await sleep(300); // politesse envers le service public
  }
  return cars;
}
