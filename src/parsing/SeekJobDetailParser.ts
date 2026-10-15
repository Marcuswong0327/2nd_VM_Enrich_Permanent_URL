import * as cheerio from 'cheerio';

export type ParsedJobDetail = {
  descriptionHtml: string;
  contactEmail: string;
  jobTitle: string;
};

const DESCRIPTION_SELECTORS = [
  '[data-automation="job-view-container"] [data-automation="jobAdDetails"]',
  '[data-automation="jobAdDetails"]',
  '[data-automation="job-detail-description"]',
  '[data-testid="job-ad-details"]',
  '[data-automation="jobDescription"]',
  '[data-automation="job-detail-description-html"]',
  '[data-automation="job-content"]',
  '.job-description',
];

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

function jobPostingDescription(data: unknown): string {
  if (!data) return '';
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = jobPostingDescription(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  if (obj['@graph']) return jobPostingDescription(obj['@graph']);
  const type = obj['@type'];
  const isJob =
    type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
  if (isJob && typeof obj.description === 'string' && obj.description.trim()) {
    return obj.description.trim();
  }
  return '';
}

function parseJsonLdDescription($: cheerio.CheerioAPI): string {
  let found = '';
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      found = jobPostingDescription(JSON.parse($(el).text()));
    } catch {
      // ignore invalid JSON-LD
    }
  });
  return found;
}

function parseJobTitle($: cheerio.CheerioAPI): string {
  const titled = $('[data-automation="job-detail-title"]').first().text().replace(/\s+/g, ' ').trim();
  if (titled) return titled;
  return $('h1').first().text().replace(/\s+/g, ' ').trim();
}

/** SRP: Seek job-detail HTML → description body, email, and title. No Playwright. */
export function parseSeekJobDetailHtml(html: string): ParsedJobDetail {
  const $ = cheerio.load(html);
  let descriptionHtml = '';

  for (const selector of DESCRIPTION_SELECTORS) {
    const el = $(selector).first();
    if (!el.length) continue;
    const text = el.text().replace(/\s+/g, ' ').trim();
    if (!text) continue;
    descriptionHtml = (el.html() || '').trim();
    if (descriptionHtml) break;
  }

  if (!descriptionHtml) {
    descriptionHtml = parseJsonLdDescription($);
  }

  const searchText = descriptionHtml
    ? cheerio.load(`<div>${descriptionHtml}</div>`).text()
    : '';
  const match = searchText.match(EMAIL_RE);

  return {
    descriptionHtml,
    contactEmail: match ? match[0] : '',
    jobTitle: parseJobTitle($),
  };
}
