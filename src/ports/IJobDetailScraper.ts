export type JobDetailPage = {
  descriptionHtml: string;
  contactEmail: string;
  jobTitle: string;
};

/** DIP: the enricher depends on this, not Playwright. May be called concurrently. */
export interface IJobDetailScraper {
  scrapeDetail(url: string): Promise<JobDetailPage>;
  close(): Promise<void>;
}
