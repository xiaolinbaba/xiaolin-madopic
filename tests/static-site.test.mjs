import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const index = read('index.html');
const script = read('script.js');
const style = read('style.css');

assert.match(
  index,
  /https:\/\/cdn\.jsdelivr\.net\/npm\/marked@\d+\.\d+\.\d+\/lib\/marked\.umd\.js/,
  'Marked must be pinned to an explicit version',
);
assert.match(
  index,
  /font-src[^;]*https:\/\/cdn\.jsdelivr\.net[^;]*;/,
  'CSP font-src must allow the jsDelivr-hosted KaTeX fonts',
);
assert.match(
  index,
  /<script src="script\.js\?v=20260716-1"><\/script>/,
  'the application script cache key must be updated with this release',
);

assert.match(
  index,
  /<link rel="stylesheet" href="style\.css\?v=20260715-2">/,
  'the stylesheet cache key must be updated with this release',
);

assert.match(
  style,
  /\.poster-content blockquote\s*\{[\s\S]*?background:\s*var\(--background-secondary\)/,
  'blockquotes must use the extra-light gray background token',
);

assert.match(
  style,
  /\.bg-preset\[data-bg="gradient1"\]\s*\{[\s\S]*?#A755F7 0%, #7275F2 50%, #6C23AA 100%/,
  'the purple preset swatch must match the exported gradient',
);

assert.match(
  index,
  /<script defer src="https:\/\/umami\.thus\.chat\/script\.js" data-website-id="3aea19d8-e893-455d-9e48-54ba56a2af8a"><\/script>/,
  'Umami script must match the production tracking snippet',
);

for (const expected of [
  '<link rel="canonical" href="https://madopic.thus.chat/">',
  '<meta property="og:site_name" content="Madopic">',
  '<meta property="og:title" content="Madopic - Markdown to Picture">',
  '<meta name="twitter:card" content="summary">',
  '<script type="application/ld+json">',
]) {
  assert.ok(index.includes(expected), `index.html should include ${expected}`);
}

for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'index.md']) {
  assert.ok(existsSync(resolve(root, file)), `${file} should exist for search and AI discovery`);
}

assert.ok(
  read('robots.txt').includes('Sitemap: https://madopic.thus.chat/sitemap.xml'),
  'robots.txt should point crawlers at the sitemap',
);

assert.ok(
  read('llms.txt').includes('[Markdown version](https://madopic.thus.chat/index.md)'),
  'llms.txt should expose the markdown page for AI retrieval',
);

assert.match(script, /trust:\s*false/, 'KaTeX trust mode should stay disabled');
assert.match(
  script,
  /htmlContent\s*=\s*sanitizeHTML\(htmlContent\);[\s\S]*?element\.innerHTML\s*=\s*cardHtml;/,
  'Card markdown must be sanitized before insertion',
);
assert.ok(
  !script.includes('<div class="error-message">${errorMessage}</div>'),
  'Mermaid error messages must not be interpolated into innerHTML',
);
assert.ok(
  script.includes('document.createTextNode(`ECharts Error: ${errorMessage}`)'),
  'ECharts error messages should be rendered as text nodes',
);
assert.ok(!script.includes('closeCustomPanel()'), 'Escape should call the existing panel close function');

assert.ok(
  !script.includes("pdf.addImage(imgData, 'PNG'"),
  'PDF export must not rasterize the whole poster into one image',
);
assert.match(
  script,
  /function buildPrintablePDFHTML[\s\S]*?@page\{size:/,
  'PDF export must build a native printable document with an exact page size',
);
assert.match(
  script,
  /printWindow\.print\(\)/,
  'PDF export must use native browser printing so text remains selectable',
);
