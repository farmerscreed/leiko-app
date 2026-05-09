// HomeLearnCard.test.tsx — Sprint 14 task 4.

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { HomeLearnCard, extractExcerpt } from '../HomeLearnCard';
import { ARTICLES_BY_ID } from '../../learn/articleIndex.gen';
import type { BlockNode } from '../../services/learn/ast';

function withTheme(node: ReactNode) {
  return <ThemeProvider mode="caregiver">{node}</ThemeProvider>;
}

describe('<HomeLearnCard />', () => {
  it('renders the eyebrow, title, and excerpt for the article', () => {
    const article = ARTICLES_BY_ID['numbers-001']!;
    render(
      withTheme(
        <HomeLearnCard
          article={article}
          onArticleOpen={() => undefined}
          onDismiss={() => undefined}
        />,
      ),
    );
    expect(screen.getByText('Worth a read')).toBeTruthy();
    expect(screen.getByText(article.frontmatter.title)).toBeTruthy();
  });

  it('tapping the body fires onArticleOpen with the article id', () => {
    const article = ARTICLES_BY_ID['hr-001']!;
    const onArticleOpen = jest.fn();
    render(
      withTheme(
        <HomeLearnCard
          article={article}
          onArticleOpen={onArticleOpen}
          onDismiss={() => undefined}
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('home-learn-card-body'));
    expect(onArticleOpen).toHaveBeenCalledWith('hr-001');
  });

  it('tapping the dismiss × fires onDismiss with the article id', () => {
    const article = ARTICLES_BY_ID['changes-001']!;
    const onDismiss = jest.fn();
    render(
      withTheme(
        <HomeLearnCard
          article={article}
          onArticleOpen={() => undefined}
          onDismiss={onDismiss}
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('home-learn-card-dismiss'));
    expect(onDismiss).toHaveBeenCalledWith('changes-001');
  });

  it('renders without a 1-line excerpt when blocks are empty', () => {
    const article = {
      ...ARTICLES_BY_ID['numbers-001']!,
      blocks: [] as BlockNode[],
    };
    render(
      withTheme(
        <HomeLearnCard
          article={article}
          onArticleOpen={() => undefined}
          onDismiss={() => undefined}
        />,
      ),
    );
    expect(screen.getByText(article.frontmatter.title)).toBeTruthy();
  });
});

describe('extractExcerpt', () => {
  it('returns empty string for empty blocks', () => {
    expect(extractExcerpt([], 100)).toBe('');
  });

  it('pulls text from the first paragraph block', () => {
    const blocks: BlockNode[] = [
      {
        type: 'heading',
        depth: 2,
        children: [{ type: 'text', value: 'Heading is skipped' }],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'A short paragraph.' }],
      },
    ];
    expect(extractExcerpt(blocks, 100)).toBe('A short paragraph.');
  });

  it('flattens strong, em, code, definition into plain text', () => {
    const blocks: BlockNode[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'A ' },
          { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
          { type: 'text', value: ' word and ' },
          { type: 'em', children: [{ type: 'text', value: 'em' }] },
          { type: 'text', value: '.' },
        ],
      },
    ];
    expect(extractExcerpt(blocks, 100)).toBe('A bold word and em.');
  });

  it('expands <Reading sys={x} dia={y} /> as text', () => {
    const blocks: BlockNode[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'A reading like ' },
          { type: 'reading', systolic: 124, diastolic: 79 },
          { type: 'text', value: '.' },
        ],
      },
    ];
    expect(extractExcerpt(blocks, 100)).toBe('A reading like 124/79 mmHg.');
  });

  it('truncates at maxLen on a word boundary with an ellipsis', () => {
    const blocks: BlockNode[] = [
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            value:
              'This is a long paragraph that should be truncated cleanly at a word boundary because we want a polished UI.',
          },
        ],
      },
    ];
    const out = extractExcerpt(blocks, 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/); // no trailing space before ellipsis
  });
});
