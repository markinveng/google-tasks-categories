/**
 * Wrapper of the support menu ("?") button. Same jsname on tasks.google.com
 * and calendar.google.com (confirmed 2026-10); may change on Google's side.
 */
const HEADER_ANCHOR = 'header[role="banner"] [jsname="cAuFpc"]';

export function findHeaderAnchor(): Element | null {
  return document.querySelector(HEADER_ANCHOR);
}

/** Places the button just before the support menu. Returns false when the header is not available. */
export function placeBeforeHeaderAnchor(button: HTMLElement): boolean {
  const anchor = findHeaderAnchor();
  if (!anchor) return false;
  if (button.nextElementSibling !== anchor) anchor.before(button);
  return true;
}

export function applyTheme(): void {
  document.documentElement.dataset.gtcTheme = isDarkTheme() ? 'dark' : 'light';
}

function isDarkTheme(): boolean {
  const match = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return false;
  const [r, g, b] = match.map(Number) as [number, number, number];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
