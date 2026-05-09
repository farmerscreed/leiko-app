// articleIndex.gen.drift.test.ts — Sprint 13 task 4.
//
// Detects when articleIndex.gen.ts is stale. Re-runs the same pipeline
// the build script uses (parser + markdown subset parser) and asserts
// the output matches the committed generated index. If they diverge,
// the dev forgot to run `npm run build:articles` after editing an MDX.

import * as fs from 'fs';
import * as path from 'path';
import { parseArticle } from '../parser';
import { parseMarkdown } from '../markdown';
import { ARTICLES } from '../../../learn/articleIndex.gen';

const ARTICLES_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'learn',
  'articles',
);

describe('articleIndex.gen.ts drift', () => {
  it('every committed article appears in ARTICLES', () => {
    const files = fs
      .readdirSync(ARTICLES_DIR)
      .filter(f => f.endsWith('.mdx'))
      .sort();
    const expectedIds = files.map(f => f.replace(/\.mdx$/, ''));
    const actualIds = ARTICLES.map(a => a.frontmatter.id).sort();
    expect(actualIds).toEqual(expectedIds);
  });

  it('each article in ARTICLES matches a fresh re-parse of its source', () => {
    for (const a of ARTICLES) {
      const file = `${a.frontmatter.id}.mdx`;
      const fullPath = path.join(ARTICLES_DIR, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = parseArticle(raw, file);
      const md = parseMarkdown(parsed.body);

      // Frontmatter must round-trip identically.
      expect(a.frontmatter).toEqual(parsed.frontmatter);
      // Block AST must be identical structure (deep equal).
      expect(a.blocks).toEqual(md.blocks);
    }
  });
});
