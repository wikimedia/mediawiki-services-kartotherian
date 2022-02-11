/**
 * Test whether the mapdata API requests are correct for what was requested.
 */

// Intercept MWApi calls.
jest.mock('mwapi');
const MWApi = require('mwapi');

const mwapiExecute = jest.fn();
MWApi.mockImplementation(() => ({
  execute: mwapiExecute,
}));

const callSnapshot = require('../utils/callSnapshot');

const unversionedRequest = {
  action: 'query',
  formatversion: '2',
  mpdgroups: 'a|b',
  mpdlimit: 'max',
  prop: 'mapdata',
  titles: 'Example',
};

const versionedRequest = {
  action: 'query',
  formatversion: '2',
  mpdgroups: 'a|b',
  mpdlimit: 'max',
  prop: 'mapdata',
  revids: '123',
};

describe('unversioned mapdata request', () => {
  test('uses page title when revid parameter is absent', async () => {
    // eslint-disable-next-line no-unused-vars
    const [req, res, next] = await callSnapshot({ versioned_maps: false });
    // FIXME: But `next` is still called because of errors after mwapi.  All
    // cases should test `next`.
    // expect(next).not.toHaveBeenCalled();
    expect(mwapiExecute).toHaveBeenCalledWith(unversionedRequest);

    await callSnapshot({ versioned_maps: true });
    expect(mwapiExecute).toHaveBeenCalledWith(unversionedRequest);
  });
});

describe('versioned mapdata request', () => {
  test('passes through revid parameter when versioned feature enabled', async () => {
    await callSnapshot({ versioned_maps: true }, { revid: '123' });
    expect(mwapiExecute).toHaveBeenCalledWith(versionedRequest);
  });

  test('ignores revid parameter when versioned feature disabled', async () => {
    await callSnapshot({ versioned_maps: false }, { revid: 123 });
    expect(mwapiExecute).toHaveBeenCalledWith(unversionedRequest);
  });
});
