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

beforeEach(() => mwapiExecute.mockClear());

// TODO: Should also test that there were no errors and the returned "next"
// function wasn't called.

describe('unversioned mapdata request', () => {
  test('uses page title when revid parameter is absent', async () => {
    await callSnapshot({ versioned_maps: false });
    expect(mwapiExecute).toHaveBeenCalledWith(unversionedRequest);
  });

  test('versioned feature config doesn\'t affect legacy query', async () => {
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
    await callSnapshot({ versioned_maps: false }, { revid: '123' });
    expect(mwapiExecute).toHaveBeenCalledWith(unversionedRequest);
  });
});

describe('domain handling', () => {
  test('strips protocol and port before validation', async () => {
    await callSnapshot({}, { domain: 'http://localhost:1234' });
    expect(mwapiExecute).toHaveBeenCalledWith(unversionedRequest);
  });

  test('rejects unknown domain', async () => {
    await callSnapshot({}, { domain: 'nasty.invalid' });
    expect(mwapiExecute).not.toHaveBeenCalled();
  });
});
