import {
  orderConstellationNodes,
  focalNode,
  statusUrgency,
  type ConstellationNode,
} from '../constellationOrder';
import type { Status } from '../../components/StatusPill';

// Minimal node fixture — only the fields ordering reads.
function node(
  id: string,
  status: Status,
  isSelf = false,
): ConstellationNode {
  return {
    id,
    isSelf,
    status,
    fullName: id,
    initial: id[0]?.toUpperCase() ?? '·',
    accentIndex: 1,
    bpLabel: '—',
    headline: '',
    sentence: '',
    relation: '',
    vitalStrip: { bp: '—', hr: '—', spo2: '—', sleep: '—' },
  };
}

describe('statusUrgency', () => {
  it('ranks urgent > attention > watch > calm states', () => {
    expect(statusUrgency('urgent')).toBeGreaterThan(statusUrgency('attention'));
    expect(statusUrgency('attention')).toBeGreaterThan(statusUrgency('watch'));
    expect(statusUrgency('watch')).toBeGreaterThan(statusUrgency('clear'));
  });

  it('treats offline and sleeping as calm (never pre-empt You)', () => {
    expect(statusUrgency('offline')).toBe(statusUrgency('clear'));
    expect(statusUrgency('sleeping')).toBe(statusUrgency('clear'));
  });
});

describe('orderConstellationNodes', () => {
  it('puts the self node first when everyone is calm', () => {
    const ordered = orderConstellationNodes([
      node('mum', 'clear'),
      node('you', 'clear', true),
      node('dad', 'clear'),
    ]);
    expect(ordered.map((n) => n.id)).toEqual(['you', 'mum', 'dad']);
  });

  it('floats an at-risk person above the self node', () => {
    const ordered = orderConstellationNodes([
      node('you', 'clear', true),
      node('mum', 'attention'),
      node('dad', 'clear'),
    ]);
    expect(ordered[0].id).toBe('mum'); // attention pre-empts You
    expect(ordered.map((n) => n.id)).toEqual(['mum', 'you', 'dad']);
  });

  it('ranks confirmed-urgent above calm-concerned above You', () => {
    const ordered = orderConstellationNodes([
      node('you', 'clear', true),
      node('mum', 'attention'),
      node('dad', 'urgent'),
    ]);
    expect(ordered.map((n) => n.id)).toEqual(['dad', 'mum', 'you']);
  });

  it('preserves incoming order among equally-calm non-self nodes', () => {
    const ordered = orderConstellationNodes([
      node('you', 'clear', true),
      node('mum', 'clear'),
      node('dad', 'clear'),
      node('aunt', 'clear'),
    ]);
    expect(ordered.map((n) => n.id)).toEqual(['you', 'mum', 'dad', 'aunt']);
  });

  it('a calm self node never displaces an urgent person even if listed first', () => {
    const ordered = orderConstellationNodes([
      node('you', 'clear', true),
      node('dad', 'urgent'),
    ]);
    expect(ordered[0].id).toBe('dad');
  });

  it('handles a pure self constellation (no one added)', () => {
    const ordered = orderConstellationNodes([node('you', 'clear', true)]);
    expect(ordered.map((n) => n.id)).toEqual(['you']);
  });

  it('handles a pure caregiver constellation (no self node)', () => {
    const ordered = orderConstellationNodes([
      node('mum', 'clear'),
      node('dad', 'urgent'),
    ]);
    expect(ordered.map((n) => n.id)).toEqual(['dad', 'mum']);
  });
});

describe('focalNode', () => {
  it('returns the most urgent node', () => {
    expect(
      focalNode([node('you', 'clear', true), node('dad', 'urgent')])?.id,
    ).toBe('dad');
  });

  it('returns the self node in a calm constellation', () => {
    expect(
      focalNode([node('mum', 'clear'), node('you', 'clear', true)])?.id,
    ).toBe('you');
  });

  it('returns null for an empty constellation', () => {
    expect(focalNode([])).toBeNull();
  });
});
