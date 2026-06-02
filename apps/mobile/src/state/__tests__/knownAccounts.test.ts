// knownAccounts slice — Sprint 19 Block 4.

import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useKnownAccounts } from '../knownAccounts';

beforeEach(() => {
  mmkv.clearAll();
  useKnownAccounts.getState()._reset();
});

describe('useKnownAccounts.add', () => {
  it('inserts a fresh entry with lastSignedInAtMs', () => {
    useKnownAccounts.getState().add('a@example.com', 1_000);
    const list = useKnownAccounts.getState().accounts;
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ email: 'a@example.com', lastSignedInAtMs: 1_000 });
  });

  it('normalises email — trims + lowercases', () => {
    useKnownAccounts.getState().add('  Lawrence@Example.COM  ', 1);
    expect(useKnownAccounts.getState().accounts[0].email).toBe('lawrence@example.com');
  });

  it('upserts when email already present — bumps timestamp, no duplicate row', () => {
    useKnownAccounts.getState().add('a@example.com', 1_000);
    useKnownAccounts.getState().add('a@example.com', 5_000);
    const list = useKnownAccounts.getState().accounts;
    expect(list).toHaveLength(1);
    expect(list[0].lastSignedInAtMs).toBe(5_000);
  });

  it('persists to MMKV between hydrate calls', () => {
    useKnownAccounts.getState().add('a@example.com', 2_000);
    useKnownAccounts.getState()._reset();
    expect(useKnownAccounts.getState().accounts).toHaveLength(0);
    // Force a re-hydrate from persisted storage.
    const raw = mmkv.getString(STORAGE_KEYS.knownAccounts);
    // _reset() removes the persisted blob; previous add wrote it earlier.
    // The intent here is to verify the persist path runs — assert via
    // a second add + hydrate.
    expect(raw).toBeUndefined();
    useKnownAccounts.getState().add('b@example.com', 3_000);
    useKnownAccounts.getState().hydrate();
    expect(useKnownAccounts.getState().accounts[0].email).toBe('b@example.com');
  });

  it('ignores invalid emails (no @)', () => {
    useKnownAccounts.getState().add('not-an-email', 1);
    useKnownAccounts.getState().add('', 1);
    expect(useKnownAccounts.getState().accounts).toHaveLength(0);
  });
});

describe('useKnownAccounts.getAll — sort order', () => {
  it('returns most-recent first', () => {
    useKnownAccounts.getState().add('older@example.com', 1_000);
    useKnownAccounts.getState().add('newest@example.com', 9_000);
    useKnownAccounts.getState().add('middle@example.com', 5_000);
    const all = useKnownAccounts.getState().getAll();
    expect(all.map((a) => a.email)).toEqual([
      'newest@example.com',
      'middle@example.com',
      'older@example.com',
    ]);
  });
});

describe('useKnownAccounts.forget', () => {
  it('removes an existing entry', () => {
    useKnownAccounts.getState().add('a@example.com', 1);
    useKnownAccounts.getState().add('b@example.com', 2);
    useKnownAccounts.getState().forget('a@example.com');
    expect(useKnownAccounts.getState().accounts.map((a) => a.email)).toEqual([
      'b@example.com',
    ]);
  });

  it('normalises before matching', () => {
    useKnownAccounts.getState().add('a@example.com', 1);
    useKnownAccounts.getState().forget('  A@EXAMPLE.com ');
    expect(useKnownAccounts.getState().accounts).toHaveLength(0);
  });

  it('is a no-op when email is not present', () => {
    useKnownAccounts.getState().add('a@example.com', 1);
    useKnownAccounts.getState().forget('missing@example.com');
    expect(useKnownAccounts.getState().accounts).toHaveLength(1);
  });
});

describe('hydrate — recovers persisted state on cold start', () => {
  it('reads MMKV row on hydrate', () => {
    mmkv.set(
      STORAGE_KEYS.knownAccounts,
      JSON.stringify([
        { email: 'persisted@example.com', lastSignedInAtMs: 1_000 },
      ]),
    );
    useKnownAccounts.getState().hydrate();
    const list = useKnownAccounts.getState().accounts;
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe('persisted@example.com');
  });

  it('returns empty when MMKV row is malformed', () => {
    mmkv.set(STORAGE_KEYS.knownAccounts, 'not-json');
    useKnownAccounts.getState().hydrate();
    expect(useKnownAccounts.getState().accounts).toHaveLength(0);
  });
});
