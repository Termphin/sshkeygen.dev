import { SITE_URL, canonicalUrl } from './site';

export interface HowToStep {
  name: string;
  html: string;
  code?: string;
  after?: string;
}

/** Removes HTML tags and decodes the few entities used in step copy, for structured data. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Builds HowTo structured data whose steps mirror the ones rendered on the page. */
export function howToSchema(options: {
  name: string;
  description: string;
  path: string;
  totalTime?: string;
  tools?: string[];
  steps: HowToStep[];
}): Record<string, unknown> {
  const url = canonicalUrl(options.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: options.name,
    description: options.description,
    url,
    image: `${SITE_URL}/og-image.png`,
    ...(options.totalTime ? { totalTime: options.totalTime } : {}),
    ...(options.tools ? { tool: options.tools.map((name) => ({ '@type': 'HowToTool', name })) } : {}),
    step: options.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: plainText(step.html),
      url: `${url}#step-${index + 1}`,
    })),
  };
}

/** Builds FAQPage structured data from question and HTML answer pairs. */
export function faqSchema(items: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: plainText(item.a) },
    })),
  };
}
