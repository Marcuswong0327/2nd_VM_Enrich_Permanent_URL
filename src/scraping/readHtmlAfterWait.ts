/** SRP: still read the document when the description locator times out. */
export async function readHtmlAfterWait(
  waitForDescription: () => Promise<void>,
  readHtml: () => Promise<string>
): Promise<string> {
  try {
    await waitForDescription();
  } catch {
    // jobAdDetails may already be in the HTML (hydration lag / JSON-LD only)
  }
  return readHtml();
}
