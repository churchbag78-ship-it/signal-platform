/**
 * Reading a client's own website.
 *
 * This is stage one of the product: the only thing the user types is a URL, so
 * everything Signal believes about them has to start here. Two properties
 * matter more than coverage.
 *
 * PROVENANCE. Every page keeps its URL and its text, because the commercial
 * model built from this corpus is checked back against it. A claim that the
 * client sells something their site never mentions is the first place this
 * product could start inventing, and `grounding.ts` can only catch that if the
 * source text is still here to check against.
 *
 * HONEST FAILURE. A page that could not be fetched is recorded as attempted
 * and unavailable. A site with three reachable pages and a site with thirty
 * must not produce equally confident models, and the only way to know which
 * you have is to keep the failures.
 */

import type { IsoDate } from '../../engine/src/domain.ts';
import type { PageRetriever } from '../../engine/src/research/retrieval.ts';

export interface SitePage {
  url: string;
  text: string;
  retrievedAt: IsoDate;
}

export interface SiteCorpus {
  domain: string;
  pages: SitePage[];
  /** URLs tried and not obtained, with the reason. Never silently dropped. */
  unavailable: { url: string; reason: string }[];
  totalChars: number;
}

/**
 * Paths worth trying on a business website, most informative first.
 *
 * Ordered by what they tell you about the COMMERCIAL model rather than the
 * company's self-image: what they sell and who buys it beats an about page.
 */
export const SITE_PATHS = [
  '',
  '/services',
  '/what-we-do',
  '/solutions',
  '/products',
  '/sectors',
  '/industries',
  '/about',
  '/about-us',
  '/case-studies',
  '/clients',
  '/customers',
  '/our-work',
  '/contact',
] as const;

export function siteUrls(domain: string, paths: readonly string[] = SITE_PATHS): string[] {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return paths.map((path) => `https://${host}${path}`);
}

/** Internal links from a page body, for sites that do not use the usual paths. */
export function internalLinks(html: string, domain: string, limit = 8): string[] {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  const found = new Set<string>();

  for (const match of html.matchAll(/href=["']([^"'#?]+)["']/gi)) {
    const href = match[1];
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href, `https://${host}/`);
    } catch {
      continue;
    }
    if (!url.hostname.toLowerCase().endsWith(host.replace(/^www\./, ''))) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|zip|mp4|webp|css|js)$/i.test(url.pathname)) continue;
    if (url.pathname === '/' || url.pathname === '') continue;
    // Depth 1 and 2 only: a blog post is rarely where a company explains its model.
    if (url.pathname.split('/').filter(Boolean).length > 2) continue;
    found.add(`${url.origin}${url.pathname.replace(/\/$/, '')}`);
    if (found.size >= limit) break;
  }

  return [...found];
}

export interface ReadSiteOptions {
  domain: string;
  retriever: PageRetriever;
  /** Stop once this much text has been gathered. Enough to model a business. */
  maxChars?: number;
  maxPages?: number;
  paths?: readonly string[];
  onPage?: (url: string, ok: boolean) => void;
}

const MIN_USEFUL_CHARS = 200;

export async function readSite(options: ReadSiteOptions): Promise<SiteCorpus> {
  const maxChars = options.maxChars ?? 60_000;
  const maxPages = options.maxPages ?? 12;
  const domain = options.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const pages: SitePage[] = [];
  const unavailable: { url: string; reason: string }[] = [];
  const seen = new Set<string>();
  let totalChars = 0;

  const queue = siteUrls(domain, options.paths);

  for (let i = 0; i < queue.length && pages.length < maxPages && totalChars < maxChars; i += 1) {
    const url = queue[i]!;
    const key = url.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);

    const outcome = await options.retriever.retrieve(url);
    options.onPage?.(url, outcome.status === 'retrieved');

    if (outcome.status !== 'retrieved') {
      unavailable.push({ url, reason: outcome.reason });
      continue;
    }

    const text = outcome.page.text.trim();
    if (text.length < MIN_USEFUL_CHARS) {
      // A near-empty body is usually a JS-rendered page or a redirect stub.
      // Counting it as a read page would overstate what the model was given.
      unavailable.push({ url, reason: `only ${text.length} characters of text — nothing to read` });
      continue;
    }

    pages.push({ url, text, retrievedAt: outcome.page.retrievedAt });
    totalChars += text.length;

    // The home page decides where else to look, for sites that do not use the
    // conventional paths. Discovered links go to the back of the queue.
    if (i === 0) queue.push(...internalLinks(outcome.page.text, domain));
  }

  return { domain, pages, unavailable, totalChars };
}

/** How much the model is being asked to infer from. Reported, never hidden. */
export function corpusQuality(corpus: SiteCorpus): {
  level: 'good' | 'thin' | 'insufficient';
  reason: string;
} {
  if (corpus.pages.length === 0) {
    return { level: 'insufficient', reason: 'no page of the website could be read' };
  }
  if (corpus.pages.length < 3 || corpus.totalChars < 2_000) {
    return {
      level: 'thin',
      reason:
        `only ${corpus.pages.length} page(s) and ${corpus.totalChars} characters were read — ` +
        'the commercial model below rests on very little and should be checked by a person',
    };
  }
  return {
    level: 'good',
    reason: `${corpus.pages.length} pages, ${corpus.totalChars} characters`,
  };
}

/** The corpus as the model sees it, with every passage still attributed. */
export function renderCorpus(corpus: SiteCorpus, perPageChars = 6_000): string {
  return corpus.pages
    .map((page) => `--- PAGE: ${page.url}\n${page.text.slice(0, perPageChars)}`)
    .join('\n\n');
}
