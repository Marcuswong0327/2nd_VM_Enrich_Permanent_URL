export type EnrichmentIngestConfig = {
  url: string;
  secret: string;
};

/** Linktal enrichment-ingest URL and the shared bearer secret. */
export function parseEnrichmentIngestConfig(
  env: NodeJS.Dict<string>
): EnrichmentIngestConfig | null {
  const url = env.ENRICHMENT_INGEST_URL?.trim().replace(/\/+$/, '');
  const secret = env.SCRAPE_COMPLETE_SECRET?.trim();
  if (!url || !secret) return null;
  return { url, secret };
}
