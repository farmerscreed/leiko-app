// markdown.test.ts — Sprint 13 task 4.

import * as fs from 'fs';
import * as path from 'path';
import { parseMarkdown, parseInline } from '../markdown';
import { parseArticle } from '../parser';

const ARTICLES_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'learn',
  'articles',
);

describe('parseInline — text + emphasis', () => {
  it('returns plain text as a single text node', () => {
    expect(parseInline('Hello world.')).toEqual([
      { type: 'text', value: 'Hello world.' },
    ]);
  });

  it('parses **bold**', () => {
    expect(parseInline('a **strong** b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'strong', children: [{ type: 'text', value: 'strong' }] },
      { type: 'text', value: ' b' },
    ]);
  });

  it('parses *italic*', () => {
    expect(parseInline('a *em* b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'em', children: [{ type: 'text', value: 'em' }] },
      { type: 'text', value: ' b' },
    ]);
  });

  it('parses inline `code`', () => {
    const result = parseInline('Set the `card_id` column.');
    expect(result).toEqual([
      { type: 'text', value: 'Set the ' },
      { type: 'code', value: 'card_id' },
      { type: 'text', value: ' column.' },
    ]);
  });

  it('mixes emphasis and code in one run', () => {
    const result = parseInline('A **bold** with *em* and `code`.');
    expect(result.map(n => n.type)).toEqual([
      'text',
      'strong',
      'text',
      'em',
      'text',
      'code',
      'text',
    ]);
  });
});

describe('parseInline — custom MDX components', () => {
  it('parses <Reading sys={x} dia={y} />', () => {
    expect(parseInline('A reading like <Reading sys={124} dia={79} />.')).toEqual([
      { type: 'text', value: 'A reading like ' },
      { type: 'reading', systolic: 124, diastolic: 79 },
      { type: 'text', value: '.' },
    ]);
  });

  it('parses <CardLink id="numbers-002" />', () => {
    expect(parseInline('See <CardLink id="numbers-002" /> next.')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'cardlink', cardId: 'numbers-002' },
      { type: 'text', value: ' next.' },
    ]);
  });

  it('parses <Definition term="systolic">...</Definition>', () => {
    const out = parseInline(
      'The top number is <Definition term="systolic">the upper pressure</Definition>.',
    );
    expect(out[0]).toEqual({ type: 'text', value: 'The top number is ' });
    const def = out[1] as Extract<typeof out[number], { type: 'definition' }>;
    expect(def.type).toBe('definition');
    expect(def.term).toBe('systolic');
    expect(def.children).toEqual([{ type: 'text', value: 'the upper pressure' }]);
  });

  it('handles emphasis inside Definition body', () => {
    const out = parseInline(
      '<Definition term="x">a *bold* term</Definition>',
    );
    const def = out[0] as Extract<typeof out[number], { type: 'definition' }>;
    expect(def.children.map(c => c.type)).toEqual(['text', 'em', 'text']);
  });

  it('does NOT treat lone < as a tag', () => {
    expect(parseInline('a < b is a comparison')).toEqual([
      { type: 'text', value: 'a < b is a comparison' },
    ]);
  });
});

describe('parseMarkdown — block-level', () => {
  it('parses an H2 heading', () => {
    const out = parseMarkdown('## Two numbers, one reading');
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0]).toEqual({
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: 'Two numbers, one reading' }],
    });
  });

  it('parses paragraphs separated by blank lines', () => {
    const md = 'First paragraph.\n\nSecond paragraph.';
    const out = parseMarkdown(md);
    expect(out.blocks).toHaveLength(2);
    expect(out.blocks[0].type).toBe('paragraph');
    expect(out.blocks[1].type).toBe('paragraph');
  });

  it('collapses soft-wrapped lines inside a paragraph', () => {
    const md = 'A long paragraph\nthat wraps in source\nbut renders flat.';
    const out = parseMarkdown(md);
    expect(out.blocks).toHaveLength(1);
    const block = out.blocks[0];
    if (block.type !== 'paragraph') throw new Error('expected paragraph');
    expect(block.children).toEqual([
      { type: 'text', value: 'A long paragraph that wraps in source but renders flat.' },
    ]);
  });

  it('parses a bullet list', () => {
    const md = '- one\n- two\n- three';
    const out = parseMarkdown(md);
    expect(out.blocks).toHaveLength(1);
    const list = out.blocks[0] as Extract<
      typeof out.blocks[number],
      { type: 'list' }
    >;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(3);
    expect(list.items[0]).toEqual([{ type: 'text', value: 'one' }]);
  });

  it('parses an ordered list', () => {
    const md = '1. first\n2. second\n3. third';
    const out = parseMarkdown(md);
    const list = out.blocks[0] as Extract<
      typeof out.blocks[number],
      { type: 'list' }
    >;
    expect(list.type).toBe('list');
    expect(list.ordered).toBe(true);
  });

  it('extracts <Source> blocks into bodySources, not blocks', () => {
    const md =
      'Body paragraph.\n\n<Source>AHA/ACC 2017</Source>\n\n<Source>WHO 2023</Source>';
    const out = parseMarkdown(md);
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0].type).toBe('paragraph');
    expect(out.bodySources).toEqual(['AHA/ACC 2017', 'WHO 2023']);
  });

  it('renders a paragraph containing strong + em + code', () => {
    const md = 'A **bold** paragraph with *em* and `code`.';
    const out = parseMarkdown(md);
    const p = out.blocks[0];
    expect(p.type).toBe('paragraph');
    if (p.type !== 'paragraph') return;
    expect(p.children.map(n => n.type)).toEqual([
      'text',
      'strong',
      'text',
      'em',
      'text',
      'code',
      'text',
    ]);
  });
});

describe('parseMarkdown — full reference articles', () => {
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.mdx'));

  it('finds the full v1.0 article corpus', () => {
    // 31 = 5 reference + 7 NUMBERS + 6 CHANGES + 2 HR + 2 SPO2 + 2 SLEEP
    //    + 1 ACTIVITY + 3 CORRELATIONS + 3 DOCTOR.
    expect(files.length).toBe(31);
  });

  for (const f of files) {
    it(`${f} — parses without throw and produces blocks`, () => {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf8');
      const article = parseArticle(raw, f);
      const out = parseMarkdown(article.body);
      expect(out.blocks.length).toBeGreaterThan(0);
      // Every article ends with the canonical "Talk to your doctor"
      // paragraph — confirm it parsed.
      const lastParagraph = [...out.blocks]
        .reverse()
        .find(b => b.type === 'paragraph');
      expect(lastParagraph).toBeDefined();
    });

    it(`${f} — uses only allowed block types`, () => {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf8');
      const article = parseArticle(raw, f);
      const out = parseMarkdown(article.body);
      const allowed = new Set(['heading', 'paragraph', 'list']);
      for (const b of out.blocks) {
        expect(allowed.has(b.type)).toBe(true);
        if (b.type === 'heading') {
          expect(b.depth).toBe(2);
        }
      }
    });

    it(`${f} — body <Source> blocks match frontmatter sources`, () => {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf8');
      const article = parseArticle(raw, f);
      const out = parseMarkdown(article.body);
      // Order doesn't have to match, but the sets do.
      expect(new Set(out.bodySources)).toEqual(new Set(article.frontmatter.sources));
    });
  }

  it('numbers-001 produces one <Reading> inline + one <Definition> for systolic', () => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, 'numbers-001.mdx'), 'utf8');
    const article = parseArticle(raw, 'numbers-001.mdx');
    const out = parseMarkdown(article.body);
    const flatten = (nodes: unknown[]): unknown[] => {
      const r: unknown[] = [];
      for (const n of nodes) {
        r.push(n);
        const obj = n as { children?: unknown[] };
        if (obj.children) r.push(...flatten(obj.children));
      }
      return r;
    };
    const allInline = flatten(
      out.blocks.flatMap(b =>
        b.type === 'list' ? b.items.flat() : 'children' in b ? b.children : [],
      ),
    );
    type AnyNode = { type?: string; term?: string };
    const readings = allInline.filter(n => (n as AnyNode).type === 'reading');
    const definitions = allInline.filter(n => (n as AnyNode).type === 'definition');
    expect(readings.length).toBe(1);
    expect(definitions.some(d => (d as AnyNode).term === 'systolic')).toBe(true);
    expect(definitions.some(d => (d as AnyNode).term === 'diastolic')).toBe(true);
  });
});
