import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { parseSeekJobDetailHtml } from '../parsing/SeekJobDetailParser.js';
import type { IJobDetailScraper, JobDetailPage } from '../ports/IJobDetailScraper.js';
import { DEFAULT_JOB_DETAIL_CONCURRENCY } from './jobDetailConcurrency.js';
import { readHtmlAfterWait } from './readHtmlAfterWait.js';

const CARD_LOAD_TIMEOUT_MS = 30_000;

export const JOB_DESCRIPTION_SELECTOR = [
  '[data-automation="jobAdDetails"]',
  '[data-automation="job-detail-description"]',
  '[data-testid="job-ad-details"]',
  '[data-automation="jobDescription"]',
].join(', ');

export type PlaywrightJobDetailScraperOptions = {
  headless?: boolean;
  loadTimeoutMs?: number;
  /** How many Playwright pages to keep ready (match enricher concurrency). */
  pagePoolSize?: number;
  launchBrowser?: () => Promise<Browser>;
};

/**
 * Opens Seek /job/{id} pages with a small page pool so two details can load
 * at once without racing on a single tab.
 */
export class PlaywrightJobDetailScraper implements IJobDetailScraper {
  private readonly headless: boolean;
  private readonly loadTimeoutMs: number;
  private readonly pagePoolSize: number;
  private readonly launchBrowser: () => Promise<Browser>;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly available: Page[] = [];
  private readonly waiters: Array<(page: Page) => void> = [];
  private poolReady: Promise<void> | null = null;

  constructor(options: PlaywrightJobDetailScraperOptions = {}) {
    this.headless = options.headless ?? true;
    this.loadTimeoutMs = options.loadTimeoutMs ?? CARD_LOAD_TIMEOUT_MS;
    this.pagePoolSize = Math.max(1, options.pagePoolSize ?? DEFAULT_JOB_DETAIL_CONCURRENCY);
    this.launchBrowser =
      options.launchBrowser ?? (() => chromium.launch({ headless: this.headless }));
  }

  async scrapeDetail(url: string): Promise<JobDetailPage> {
    const page = await this.acquirePage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.loadTimeoutMs });
      const html = await readHtmlAfterWait(
        () =>
          page
            .locator(JOB_DESCRIPTION_SELECTOR)
            .filter({ hasText: /\S/ })
            .first()
            .waitFor({ state: 'visible', timeout: this.loadTimeoutMs }),
        () => page.content()
      );
      return parseSeekJobDetailHtml(html);
    } finally {
      this.releasePage(page);
    }
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.available.length = 0;
    this.waiters.length = 0;
    this.poolReady = null;
    this.context = null;
    this.browser = null;
  }

  private async acquirePage(): Promise<Page> {
    await this.ensurePool();
    const idle = this.available.pop();
    if (idle) return idle;
    return new Promise<Page>((resolve) => this.waiters.push(resolve));
  }

  private releasePage(page: Page): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(page);
      return;
    }
    this.available.push(page);
  }

  private async ensurePool(): Promise<void> {
    if (this.poolReady) return this.poolReady;

    this.poolReady = (async () => {
      this.browser = await this.launchBrowser();
      this.context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'en-AU',
      });
      for (let i = 0; i < this.pagePoolSize; i++) {
        this.available.push(await this.context.newPage());
      }
    })();

    return this.poolReady;
  }
}
