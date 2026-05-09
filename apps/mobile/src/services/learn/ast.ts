// Learn module — AST schema. Sprint 13 task 4.
//
// The article body is precompiled at build time (scripts/build-articles.ts)
// from MDX into this typed AST. The runtime imports a generated
// articleIndex.gen.ts and walks each article's AST through
// <ArticleRenderer>.
//
// Why precompile? See sprint plan task 4 — deterministic, testable,
// no Metro/Expo plugin risk, and the generated file is reviewable in
// PRs alongside the .mdx source.
//
// Format scope (matches docs/08-learn-module.md §11 + the lint
// constraint that articles use H2 only, bulleted lists for enumerable
// items, no tables, no H3, no images inline):
//
//   Block-level:    H2 · paragraph · bullet list · ordered list
//   Inline:         text · strong · em · inline code
//   Custom MDX:     Definition · CardLink · Reading
//
// `<Source>` is intentionally NOT in the AST. Body `<Source>` blocks
// are sugar for the canonical frontmatter `sources: []`; the parser
// strips them and the build-articles script asserts they match
// frontmatter.

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'definition'; term: string; children: InlineNode[] }
  | { type: 'cardlink'; cardId: string }
  | { type: 'reading'; systolic: number; diastolic: number };

export type BlockNode =
  | { type: 'heading'; depth: 2; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] };

export type ASTNode = BlockNode | InlineNode;

/**
 * The shape the build script writes to articleIndex.gen.ts. The
 * runtime imports this directly — no parser at runtime, no raw MDX
 * shipped in the bundle.
 */
export interface CompiledArticle {
  frontmatter: import('./types').ArticleFrontmatter;
  blocks: BlockNode[];
  /** Source-of-record path, useful for debugging. */
  sourcePath: string;
}
