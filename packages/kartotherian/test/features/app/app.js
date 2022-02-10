const preq = require('preq');
const rp = require('request-promise');
const assert = require('../../utils/assert');
const server = require('../../utils/server');

describe('express app', () => {
  beforeAll(() => server.start());

  it('should get robots.txt', () => preq.get({
    uri: `${server.config.uri}robots.txt`,
  }, 20000).then((res) => {
    assert.deepEqual(res.status, 200);
    assert.deepEqual(res.headers.disallow, '/');
  }));

  it('should set CORS headers', () => {
    if (server.config.service.conf.cors === false) {
      return true;
    }
    return preq.get({
      uri: `${server.config.uri}robots.txt`,
    }).then((res) => {
      assert.deepEqual(res.status, 200);
      assert.deepEqual(res.headers['access-control-allow-origin'], '*');
      assert.deepEqual(!!res.headers['access-control-allow-headers'], true);
      assert.deepEqual(!!res.headers['access-control-expose-headers'], true);
    });
  }, 20000);

  it('should set CSP headers', () => preq.get({
    uri: `${server.config.uri}robots.txt`,
  }).then((res) => {
    assert.deepEqual(res.status, 200);
    assert.deepEqual(res.headers['x-xss-protection'], '1; mode=block');
    assert.deepEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.deepEqual(res.headers['content-security-policy'], 'default-src');
    assert.deepEqual(res.headers['x-content-security-policy'], 'default-src');
    assert.deepEqual(res.headers['x-webkit-csp'], 'default-src');
  }), 20000);

  it('should get static content gzipped', () => rp({
    uri: `${server.config.uri}index.html`,
    headers: {
      'accept-encoding': 'gzip, deflate',
    },
    resolveWithFullResponse: true,
  }, 20000).then((res) => {
    // check that the response is gzip-ed
    assert.deepEqual(res.headers['content-encoding'], 'gzip', 'Expected gzipped contents!');
  }));

  it('should get static content uncompressed', () => rp({
    uri: `${server.config.uri}index.html`,
    headers: {
      'accept-encoding': '',
    },
    resolveWithFullResponse: true,
  }, 20000).then((res) => {
    // check that the response is gzip-ed
    assert.deepEqual(res.headers['content-encoding'], undefined, 'Did not expect gzipped contents!');
  }));
});
