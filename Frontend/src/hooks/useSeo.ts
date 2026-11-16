import { useEffect } from 'react';

const SITE_NAME = 'Nyochavar';
const DEFAULT_TITLE = 'Nyochavar - Luxury Gifting Concierge';

interface SeoOptions {
  /** Page name; the site name is added after it */
  title?: string;
  description?: string;
  /** Absolute or site-relative image used when the page is shared */
  image?: string;
  /** schema.org data (for example a Product) so search engines understand the page */
  jsonLd?: Record<string, unknown>;
}

const absoluteUrl = (value: string) => {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

/** Finds or creates a <head> tag; returns a function that puts it back the way it was. */
const upsertTag = (selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  const previous = el.cloneNode(true) as HTMLElement;
  apply(el);
  return () => {
    if (!el) return;
    if (created) el.remove();
    else el.replaceWith(previous);
  };
};

const metaTag = (attr: 'name' | 'property', key: string, content: string) =>
  upsertTag(
    `meta[${attr}="${key}"]`,
    () => {
      const el = document.createElement('meta');
      el.setAttribute(attr, key);
      return el;
    },
    (el) => el.setAttribute('content', content)
  );

/**
 * Gives the current page its own browser title, description, share preview (Open Graph / Twitter) and
 * optional structured data. Everything is put back when the page is left.
 */
export function useSeo({ title, description, image, jsonLd }: SeoOptions) {
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    const undo: Array<() => void> = [];
    const previousTitle = document.title;
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const url = `${window.location.origin}${window.location.pathname}`;
    document.title = fullTitle;

    if (description) undo.push(metaTag('name', 'description', description));
    undo.push(
      upsertTag(
        'link[rel="canonical"]',
        () => {
          const el = document.createElement('link');
          el.setAttribute('rel', 'canonical');
          return el;
        },
        (el) => el.setAttribute('href', url)
      )
    );

    undo.push(metaTag('property', 'og:site_name', SITE_NAME));
    undo.push(metaTag('property', 'og:type', jsonLdText ? 'product' : 'website'));
    undo.push(metaTag('property', 'og:title', fullTitle));
    undo.push(metaTag('property', 'og:url', url));
    if (description) undo.push(metaTag('property', 'og:description', description));
    if (image) undo.push(metaTag('property', 'og:image', absoluteUrl(image)));
    undo.push(metaTag('name', 'twitter:card', image ? 'summary_large_image' : 'summary'));
    undo.push(metaTag('name', 'twitter:title', fullTitle));
    if (description) undo.push(metaTag('name', 'twitter:description', description));
    if (image) undo.push(metaTag('name', 'twitter:image', absoluteUrl(image)));

    if (jsonLdText) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = jsonLdText;
      document.head.appendChild(script);
      undo.push(() => script.remove());
    }

    return () => {
      document.title = previousTitle;
      undo.reverse().forEach((fn) => fn());
    };
  }, [title, description, image, jsonLdText]);
}
