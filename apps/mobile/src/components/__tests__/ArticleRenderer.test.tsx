// ArticleRenderer.test.tsx — Sprint 13 task 4 part 2.

import { render, screen, fireEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../../theme';
import { ArticleRenderer } from '../ArticleRenderer';
import { ARTICLES, ARTICLES_BY_ID } from '../../learn/articleIndex.gen';
import type { CompiledArticle } from '../../services/learn/ast';

function withTheme(node: ReactNode) {
  return <ThemeProvider mode="caregiver">{node}</ThemeProvider>;
}

describe('<ArticleRenderer /> — happy path', () => {
  it('renders the article title as a screen-reader header', () => {
    const article = ARTICLES_BY_ID['numbers-001']!;
    render(withTheme(<ArticleRenderer article={article} />));
    const header = screen.getByRole('header', {
      name: /What is blood pressure\?/,
    });
    expect(header).toBeTruthy();
  });

  it('renders every shipped reference article without throwing', () => {
    for (const article of ARTICLES) {
      const { unmount } = render(withTheme(<ArticleRenderer article={article} />));
      expect(
        screen.getByRole('header', { name: article.frontmatter.title }),
      ).toBeTruthy();
      unmount();
    }
  });

  it('renders the canonical "Talk to your doctor" closing line', () => {
    const article = ARTICLES_BY_ID['numbers-001']!;
    render(withTheme(<ArticleRenderer article={article} />));
    expect(
      screen.getByText(/Talk to your doctor about what is right for you\./),
    ).toBeTruthy();
  });

  it('renders sources footer with every frontmatter source', () => {
    const article = ARTICLES_BY_ID['spo2-001']!;
    render(withTheme(<ArticleRenderer article={article} />));
    expect(screen.getByTestId('article-sources-footer')).toBeTruthy();
    for (const src of article.frontmatter.sources) {
      expect(screen.getByText(src)).toBeTruthy();
    }
  });

  it('renders last-reviewed metadata line', () => {
    const article = ARTICLES_BY_ID['numbers-001']!;
    render(withTheme(<ArticleRenderer article={article} />));
    const lastReviewed = screen.getByTestId('article-last-reviewed');
    expect(lastReviewed).toBeTruthy();
  });
});

describe('<ArticleRenderer /> — block types', () => {
  function makeArticle(blocks: CompiledArticle['blocks']): CompiledArticle {
    return {
      frontmatter: {
        id: 'test-001',
        title: 'Test article',
        category: 'NUMBERS',
        audience: ['self_buyer'],
        mode_relevance: ['self'],
        reading_context: {
          systolic_min: 0,
          systolic_max: 999,
          diastolic_min: 0,
          diastolic_max: 999,
        },
        inline_explainer_priority: 1,
        related_cards: [],
        sources: [],
        last_reviewed: '2026-05-09',
        reviewed_by: null,
        clinical_review_required: false,
        clinical_reviewed_at: null,
        locale_status: { en: 'complete' },
      },
      blocks,
      sourcePath: 'test-001.mdx',
    };
  }

  it('renders an H2 heading', () => {
    const article = makeArticle([
      {
        type: 'heading',
        depth: 2,
        children: [{ type: 'text', value: 'Two numbers, one reading' }],
      },
    ]);
    render(withTheme(<ArticleRenderer article={article} />));
    expect(
      screen.getByRole('header', { name: 'Two numbers, one reading' }),
    ).toBeTruthy();
  });

  it('renders a paragraph', () => {
    const article = makeArticle([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'A reading is a snapshot.' }],
      },
    ]);
    render(withTheme(<ArticleRenderer article={article} />));
    expect(screen.getByText('A reading is a snapshot.')).toBeTruthy();
  });

  it('renders a bullet list with all items', () => {
    const article = makeArticle([
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'text', value: 'Food' }],
          [{ type: 'text', value: 'Sleep' }],
          [{ type: 'text', value: 'Caffeine' }],
        ],
      },
    ]);
    render(withTheme(<ArticleRenderer article={article} />));
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Sleep')).toBeTruthy();
    expect(screen.getByText('Caffeine')).toBeTruthy();
  });

  it('renders an ordered list with sequential numbers', () => {
    const article = makeArticle([
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'text', value: 'first' }],
          [{ type: 'text', value: 'second' }],
        ],
      },
    ]);
    render(withTheme(<ArticleRenderer article={article} />));
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();
    // Sequential numbers are stable rendering details — both must appear.
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
  });
});

describe('<ArticleRenderer /> — inline custom components', () => {
  it('renders <Reading /> as accessible mmHg pair', () => {
    const article = ARTICLES_BY_ID['numbers-001']!;
    render(withTheme(<ArticleRenderer article={article} />));
    // numbers-001 has <Reading sys={124} dia={79} />
    expect(
      screen.getByLabelText(/Sample reading 124 over 79/),
    ).toBeTruthy();
  });

  it('renders <Definition> children inline with accessibility label', () => {
    const article = ARTICLES_BY_ID['numbers-001']!;
    render(withTheme(<ArticleRenderer article={article} />));
    // numbers-001 has <Definition term="systolic">...</Definition>
    expect(
      screen.getByLabelText(/Definition of systolic/),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(/Definition of diastolic/),
    ).toBeTruthy();
  });

  it('CardLink fires onCardLinkPress when tapped', () => {
    const onPress = jest.fn();
    const article = {
      frontmatter: {
        ...ARTICLES_BY_ID['numbers-001']!.frontmatter,
        sources: [],
      },
      blocks: [
        {
          type: 'paragraph' as const,
          children: [
            { type: 'text' as const, value: 'See ' },
            { type: 'cardlink' as const, cardId: 'numbers-002' },
            { type: 'text' as const, value: '.' },
          ],
        },
      ],
      sourcePath: 'test.mdx',
    };
    render(withTheme(<ArticleRenderer article={article} onCardLinkPress={onPress} />));
    const link = screen.getByRole('link', { name: /Open card numbers-002/ });
    fireEvent.press(link);
    expect(onPress).toHaveBeenCalledWith('numbers-002');
  });
});

describe('<ArticleRenderer /> — voice / structural sanity', () => {
  it('every reference article ends with the canonical doctor line', () => {
    for (const article of ARTICLES) {
      const { unmount } = render(withTheme(<ArticleRenderer article={article} />));
      expect(
        screen.getByText(/Talk to your doctor about what is right for you\./),
      ).toBeTruthy();
      unmount();
    }
  });

  it('every reference article surfaces a Sources footer', () => {
    for (const article of ARTICLES) {
      const { unmount } = render(withTheme(<ArticleRenderer article={article} />));
      expect(screen.getByTestId('article-sources-footer')).toBeTruthy();
      unmount();
    }
  });
});
