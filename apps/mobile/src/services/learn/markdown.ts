// Learn module — hand-rolled markdown subset parser. Sprint 13 task 4.
//
// Parses the article body (post-frontmatter) into a typed AST per
// services/learn/ast.ts. Pure function, no runtime dependencies.
//
// Why hand-rolled instead of `unified` / `remark` / `@mdx-js/mdx`?
//   - The article format is constrained: H2 only (max 3), paragraphs,
//     bullet lists for enumerable items, no tables, no H3, no images.
//     Voice-lint enforces a lot of this at PR time.
//   - Only four custom MDX components ship at v1.0:
//     <Definition term="...">...</Definition>, <CardLink id="..." />,
//     <Reading sys={n} dia={n} />, <Source>...</Source>.
//   - A 250-line parser tested against the full corpus is lighter and
//     easier to maintain than wrestling unified plugin order on RN.
//
// Authors do NOT need to escape the four custom-component characters
// in their prose — `<` is only meaningful when followed by one of
// our recognised tag names (`Definition` / `CardLink` / `Reading` /
// `Source`).

import type { BlockNode, InlineNode } from './ast';

// -----------------------------------------------------------------
// Block-level tokenisation.
//
// We split the body on blank lines, classify each block by its first
// character, and parse inline runs inside.
//
// `<Source>...</Source>` blocks are dropped — the canonical sources
// list lives on the frontmatter.
// -----------------------------------------------------------------

export interface ParseResult {
  blocks: BlockNode[];
  /** Body `<Source>` content the build script can reconcile against frontmatter. */
  bodySources: string[];
}

const BLANK_LINE_RE = /\n\s*\n/;
const SOURCE_GLOBAL_RE = /<Source\s*>([\s\S]*?)<\/Source>/g;
const HEADING_H2_RE = /^##\s+(.+)$/;
const BULLET_RE = /^-\s+(.+)$/;
const ORDERED_RE = /^\d+\.\s+(.+)$/;

export function parseMarkdown(body: string): ParseResult {
  const blocks: BlockNode[] = [];
  const bodySources: string[] = [];

  // First pass: extract ALL <Source> blocks, regardless of how the
  // author spaced them. Authors commonly write source citations
  // stacked at the foot of the file with no blank lines between
  // them — handle that.
  const stripped = body.replace(SOURCE_GLOBAL_RE, (_, inner: string) => {
    bodySources.push(inner.trim());
    return '';
  });

  // Split the rest on blank-line boundaries, then trim each chunk.
  const chunks = stripped.split(BLANK_LINE_RE).map(c => c.trim()).filter(Boolean);

  for (const raw of chunks) {

    // H2.
    const headingMatch = raw.match(HEADING_H2_RE);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        depth: 2,
        children: parseInline(headingMatch[1].trim()),
      });
      continue;
    }

    // Bullet list — every line starts with `- `.
    if (raw.split('\n').every(l => BULLET_RE.test(l.trim()))) {
      const items = raw.split('\n').map(l => {
        const m = l.trim().match(BULLET_RE);
        return parseInline(m ? m[1].trim() : '');
      });
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list.
    if (raw.split('\n').every(l => ORDERED_RE.test(l.trim()))) {
      const items = raw.split('\n').map(l => {
        const m = l.trim().match(ORDERED_RE);
        return parseInline(m ? m[1].trim() : '');
      });
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Default: paragraph. Collapse internal newlines to a single
    // space — markdown convention for soft-wrapped paragraphs.
    blocks.push({
      type: 'paragraph',
      children: parseInline(raw.replace(/\s*\n\s*/g, ' ')),
    });
  }

  return { blocks, bodySources };
}

// -----------------------------------------------------------------
// Inline parser.
//
// Token order matters — we walk left-to-right, trying each pattern
// in priority. A miss falls through to plain text.
//
// Priority:
//   1. <Definition term="x">...</Definition>
//   2. <CardLink id="x" />
//   3. <Reading sys={n} dia={n} />
//   4. `inline code`
//   5. **strong**
//   6. *em*
//   7. plain text
// -----------------------------------------------------------------

const DEFINITION_RE = /^<Definition\s+term=(?:"([^"]*)"|'([^']*)')\s*>([\s\S]*?)<\/Definition>/;
const CARDLINK_RE = /^<CardLink\s+id=(?:"([^"]*)"|'([^']*)')\s*\/>/;
const READING_RE = /^<Reading\s+sys=\{(-?\d+)\}\s+dia=\{(-?\d+)\}\s*\/>/;
const INLINE_CODE_RE = /^`([^`\n]+)`/;
const STRONG_RE = /^\*\*([^*]+(?:\*[^*]+)*)\*\*/;
const EM_RE = /^\*([^*\n]+)\*/;

export function parseInline(input: string): InlineNode[] {
  const out: InlineNode[] = [];
  let s = input;
  let textBuf = '';

  const flushText = () => {
    if (textBuf.length > 0) {
      out.push({ type: 'text', value: textBuf });
      textBuf = '';
    }
  };

  while (s.length > 0) {
    let m: RegExpMatchArray | null;

    if ((m = s.match(DEFINITION_RE))) {
      flushText();
      const term = m[1] ?? m[2] ?? '';
      out.push({
        type: 'definition',
        term,
        children: parseInline(m[3]),
      });
      s = s.slice(m[0].length);
      continue;
    }
    if ((m = s.match(CARDLINK_RE))) {
      flushText();
      const id = m[1] ?? m[2] ?? '';
      out.push({ type: 'cardlink', cardId: id });
      s = s.slice(m[0].length);
      continue;
    }
    if ((m = s.match(READING_RE))) {
      flushText();
      out.push({
        type: 'reading',
        systolic: Number(m[1]),
        diastolic: Number(m[2]),
      });
      s = s.slice(m[0].length);
      continue;
    }
    if ((m = s.match(INLINE_CODE_RE))) {
      flushText();
      out.push({ type: 'code', value: m[1] });
      s = s.slice(m[0].length);
      continue;
    }
    if ((m = s.match(STRONG_RE))) {
      flushText();
      out.push({ type: 'strong', children: parseInline(m[1]) });
      s = s.slice(m[0].length);
      continue;
    }
    if ((m = s.match(EM_RE))) {
      flushText();
      out.push({ type: 'em', children: parseInline(m[1]) });
      s = s.slice(m[0].length);
      continue;
    }

    // No tokenizer matched — eat one char into the text buffer and
    // advance.
    textBuf += s[0];
    s = s.slice(1);
  }

  flushText();
  return mergeAdjacentText(out);
}

/** Coalesce neighbouring text nodes (occurs when an em / strong
 *  cluster sits between two text runs that didn't get flushed
 *  together). Keeps the AST tidy. */
function mergeAdjacentText(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (last && last.type === 'text' && n.type === 'text') {
      last.value += n.value;
    } else {
      out.push(n);
    }
  }
  return out;
}
