/**
 * MIT License
 *
 * Copyright (c) 2017 kartotherian
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const assert = require('assert');
const _ = require('underscore');
const checkType = require('../lib/input-validator');

describe('checkType', () => {
  function pass(expValue, obj, field, expType, mustHave, min, max) {
    assert.strictEqual(checkType(obj, field, expType, mustHave, min, max), true);
    if (_.isObject(obj)) {
      assert.deepStrictEqual(obj[field], expValue);
    }
  }

  function dflt(expValue, field, expType, mustHave, min, max) {
    const obj = {};
    assert.strictEqual(checkType(obj, field, expType, mustHave, min, max), false);
    if (_.isObject(obj)) {
      assert.deepStrictEqual(obj[field], expValue);
    }
  }

  function fail(obj, field, expType, mustHave, min, max) {
    try {
      checkType(obj, field, expType, mustHave, min, max);
      assert(false);
    } catch (err) {
      // pass
    }
  }

  it('default param', () => dflt(10, 'fld', 'number', 10));
  it('number', () => pass(10, { fld: 10 }, 'fld', 'number', true));
  it('number min max', () => pass(10, { fld: 10 }, 'fld', 'number', true, 1, 20));
  it('fail number min max', () => fail({ fld: 10 }, 'fld', 'number', true, 1, 5));
  it('fail not number', () => fail({ fld: 'a' }, 'fld', 'number'));
  it('zoom', () => pass(10, { fld: 10 }, 'fld', 'zoom'));
  it('!zoom', () => fail({ fld: 27 }, 'fld', 'zoom'));
  it('string', () => pass('a', { fld: 'a' }, 'fld', 'string'));
  it('string, min=1', () => pass('a', { fld: 'a' }, 'fld', 'string', 1));
  it('!string, min=1', () => fail({ fld: '' }, 'fld', 'string', 1));
  it('string-array', () => pass(['a'], { fld: 'a' }, 'fld', 'string-array'));
});

describe('strToInt', () => {
  const test = function test(value, expected) {
    return () => assert.strictEqual(checkType.strToInt(value), expected);
  };

  it('int', test(0, 0));
  it('strint', test('1', 1));
  it('neg strint', test('-1', -1));
  it('float', test('1.1', '1.1'));
  it('empty', test('', ''));
  it('letter', test('a', 'a'));
});

describe('strToFloat', () => {
  const test = function test(value, expected) {
    return () => assert.strictEqual(checkType.strToFloat(value), expected);
  };

  it('int', test(0, 0));
  it('strint', test('1', 1));
  it('neg strint', test('-1', -1));
  it('strfloat', test('1.1', 1.1));
  it('empty', test('', ''));
  it('letter', test('a', 'a'));
});

describe('normalizeUrl', () => {
  const test = function test(value, protocol, host, query) {
    return () => {
      const uri = checkType.normalizeUrl(value);
      assert.strictEqual(uri.protocol, protocol);
      assert.strictEqual(uri.host, host);
      assert.deepEqual(uri.query, query);
    };
  };

  it('str no query', test('prot://hst', 'prot:', 'hst', {}));
  it('str w query', test('prot://hst?a=b', 'prot:', 'hst', { a: 'b' }));
  it('obj w query str', test({ query: 'a=b' }, undefined, undefined, { a: 'b' }));
  it('obj w query obj', test({ query: { a: 'b' } }, undefined, undefined, { a: 'b' }));
});
