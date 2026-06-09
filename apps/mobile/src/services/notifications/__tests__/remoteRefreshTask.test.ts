import {
  extractRefreshType,
  isRemoteRefreshData,
} from '../remoteRefreshTask';

describe('extractRefreshType — reads { type } across delivery shapes', () => {
  it('Android data message: { data: { type } }', () => {
    expect(extractRefreshType({ data: { type: 'sync_refresh' } })).toBe('sync_refresh');
  });

  it('wrapped notification.data', () => {
    expect(
      extractRefreshType({ notification: { data: { type: 'sync_refresh' } } }),
    ).toBe('sync_refresh');
  });

  it('expo Notification object: notification.request.content.data', () => {
    expect(
      extractRefreshType({
        notification: { request: { content: { data: { type: 'sync_refresh' } } } },
      }),
    ).toBe('sync_refresh');
  });

  it('foreground listener passes the data object directly', () => {
    expect(extractRefreshType({ type: 'sync_refresh' })).toBe('sync_refresh');
  });

  it('returns undefined for non-object / empty', () => {
    expect(extractRefreshType(undefined)).toBeUndefined();
    expect(extractRefreshType(null)).toBeUndefined();
    expect(extractRefreshType('sync_refresh')).toBeUndefined();
    expect(extractRefreshType({})).toBeUndefined();
  });
});

describe('isRemoteRefreshData', () => {
  it('true only for type === sync_refresh', () => {
    expect(isRemoteRefreshData({ type: 'sync_refresh' })).toBe(true);
    expect(isRemoteRefreshData({ data: { type: 'sync_refresh' } })).toBe(true);
  });

  it('false for other categories / shapes', () => {
    expect(isRemoteRefreshData({ type: 'anomaly' })).toBe(false);
    expect(isRemoteRefreshData({ category: 'daily' })).toBe(false);
    expect(isRemoteRefreshData(undefined)).toBe(false);
  });
});
