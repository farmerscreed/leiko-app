// AI module — card-matcher keyword stage. Sprint 11 task 7.
//
// Pure function: given a user question and the article corpus,
// returns the highest-scoring article id (or null when no card has
// any keyword overlap). The cosine-similarity stage of
// docs/07-ai-assistant.md §6 is gated on OPENAI_API_KEY (Sprint 12).
//
// Scoring is intentionally simple — title and id-based keyword
// overlap, normalized to 0..1. A direct title hit yields 1.0; a
// single-keyword hit yields ~0.2. Ties break by stable id.
//
// Sourced from:
//   docs/07-ai-assistant.md §6 (matchCard contract, 0.78 cosine threshold
//     — cosine stage is Sprint 12)
//   docs/_reference/D14-ambient-ai-architecture.md §10 (multi-vital
//     cluster IDs)

import type { CompiledArticle } from '../learn/ast';
import type { CardMatchResult } from './types';

/**
 * Keyword-stage card matcher. Pure function — no network, no
 * embeddings. Returns the best-matching article id and its score.
 *
 * @returns null if no article has any keyword overlap with the
 * question. Caller falls back to ANSWER without a card link.
 */
export function matchCardByKeyword(
  question: string,
  articles: ReadonlyArray<CompiledArticle>,
): CardMatchResult | null {
  const tokens = tokenize(question);
  if (tokens.length === 0) return null;

  let best: { article: CompiledArticle; score: number; matched: string[] } | null =
    null;

  for (const article of articles) {
    const haystack = buildHaystack(article);
    const matched: string[] = [];
    let hits = 0;
    for (const t of tokens) {
      if (haystack.has(t)) {
        matched.push(t);
        hits++;
      }
    }
    if (hits === 0) continue;
    // F1-style score: balances how much of the question we covered
    // (recall) against how relevant the article is to the question
    // (precision = hits / article_keywords). This prevents a long-
    // titled article that happens to mention "blood pressure" from
    // outranking the canonical "What is blood pressure?" card.
    const precision = hits / haystack.size;
    const recall = hits / tokens.length;
    const score = (2 * precision * recall) / (precision + recall);

    if (
      best === null ||
      score > best.score ||
      // tie-break by lower inline_explainer_priority (priority 1 wins)
      (score === best.score &&
        article.frontmatter.inline_explainer_priority <
          best.article.frontmatter.inline_explainer_priority) ||
      // final tie-break by stable id
      (score === best.score &&
        article.frontmatter.inline_explainer_priority ===
          best.article.frontmatter.inline_explainer_priority &&
        article.frontmatter.id < best.article.frontmatter.id)
    ) {
      best = { article, score, matched };
    }
  }

  if (best === null) return null;
  return {
    cardId: best.article.frontmatter.id,
    score: best.score,
    matchedKeywords: best.matched,
  };
}

// -----------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'do',
  'does',
  'for',
  'from',
  'has',
  'have',
  'how',
  'i',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Build the keyword haystack for an article — its id parts (split
 * on `-`), the title tokens, and the category. This is the v1.0
 * keyword surface; cosine stage will widen it with body content.
 */
function buildHaystack(article: CompiledArticle): Set<string> {
  const out = new Set<string>();
  // ID parts: "numbers-001" → "numbers" + "001"
  for (const part of article.frontmatter.id.split('-')) {
    if (part.length >= 2) out.add(part.toLowerCase());
  }
  // Title tokens
  for (const tok of tokenize(article.frontmatter.title)) {
    out.add(tok);
  }
  // Category — useful when the user types "what is sleep" → matches
  // any SLEEP-cluster article.
  out.add(article.frontmatter.category.toLowerCase());
  return out;
}
