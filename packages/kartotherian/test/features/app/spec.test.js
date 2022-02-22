const preq = require('preq');
const assert = require('../../utils/assert');
const Server = require('../../utils/server');
// eslint-disable-next-line
const URI = require('swagger-router').URI;
// eslint-disable-next-line
const OpenAPISchemaValidator = require('openapi-schema-validator').default;
const yaml = require('js-yaml');
const fs = require('fs');

const validator = new OpenAPISchemaValidator({ version: 2 });

let spec = null;
let baseUrl = null;
const server = new Server();

function validateExamples(pathStr, defParams, mSpec) {
  const uri = new URI(pathStr, {}, true);

  if (!mSpec) {
    try {
      uri.expand(defParams);
      return true;
    } catch (e) {
      throw new Error(`Missing parameter for route ${pathStr} : ${e.message}`);
    }
  }

  if (!Array.isArray(mSpec)) {
    throw new Error(`Route ${pathStr} : x-amples must be an array!`);
  }

  mSpec.forEach((ex, idx) => {
    if (!ex.title) {
      throw new Error(`Route ${pathStr}, example ${idx}: title missing!`);
    }
    // eslint-disable-next-line
    ex.request = ex.request || {};
    try {
      uri.expand(Object.assign({}, defParams, ex.request.params || {}));
    } catch (e) {
      throw new Error(`Route ${pathStr}, example ${idx} (${ex.title}): missing parameter: ${e.message}`);
    }
  });

  return true;
}

function constructTestCase(title, path, method, request, response) {
  return {
    title,
    request: {
      uri: (baseUrl || 'http://localhost:6533/') + (path[0] === '/' ? path.slice(1) : path),
      method,
      headers: request.headers || {},
      query: request.query,
      body: request.body,
      followRedirect: false,
    },
    response: {
      status: response.status || 200,
      headers: response.headers || {},
      body: response.body,
    },
  };
}

function constructTests(appSpec) {
  const ret = [];
  // eslint-disable-next-line
  const paths = appSpec.paths;
  const defParams = appSpec['x-default-params'] || {};

  Object.keys(paths).forEach((pathStr) => {
    Object.keys(paths[pathStr]).forEach((method) => {
      const p = paths[pathStr][method];
      if ({}.hasOwnProperty.call(p, 'x-monitor') && !p['x-monitor']) {
        return;
      }
      const uri = new URI(pathStr, {}, true);
      if (!p['x-amples']) {
        ret.push(constructTestCase(
          pathStr,
          uri.toString({ params: defParams }),
          method,
          {},
          {}
        ));
        return;
      }
      p['x-amples'].forEach((ex) => {
        // eslint-disable-next-line
        ex.request = ex.request || {};
        ret.push(constructTestCase(
          ex.title,
          uri.toString({
            params: Object.assign(
              {},
              defParams,
              ex.request.params || {}
            ),
          }),
          method,
          ex.request,
          ex.response || {}
        ));
      });
    });
  });

  return ret;
}

function cmp(result, expected, errMsg) {
  if (expected === null || expected === undefined) {
    // nothing to expect, so we can return
    return true;
  }
  if (result === null || result === undefined) {
    // eslint-disable-next-line
    result = '';
  }

  if (expected.constructor === Object) {
    Object.keys(expected).forEach((key) => {
      const val = expected[key];
      assert.deepEqual(
        {}.hasOwnProperty.call(result, key), true,
        `Body field ${key} not found in response!`
      );
      cmp(result[key], val, `${key} body field mismatch!`);
    });
    return true;
  } else if (expected.constructor === Array) {
    if (result.constructor !== Array) {
      assert.deepEqual(result, expected, errMsg);
      return true;
    }
    // only one item in expected - compare them all
    if (expected.length === 1 && result.length > 1) {
      result.forEach((item) => {
        cmp(item, expected[0], errMsg);
      });
      return true;
    }
    // more than one item expected, check them one by one
    if (expected.length !== result.length) {
      assert.deepEqual(result, expected, errMsg);
      return true;
    }
    expected.forEach((item, idx) => {
      cmp(result[idx], item, errMsg);
    });
    return true;
  }

  if (expected.length > 1 && expected[0] === '/' && expected[expected.length - 1] === '/') {
    if (new RegExp(expected.slice(1, -1)).test(result)) {
      return true;
    }
  } else if (expected.length === 0 && result.length === 0) {
    return true;
  } else if (result === expected || result.startsWith(expected)) {
    return true;
  }

  assert.deepEqual(result, expected, errMsg);
  return true;
}

function validateArray(val, resVal, key) {
  assert.deepEqual(Array.isArray(resVal), true, `Body field ${key} is not an array!`);
  let arrVal;
  if (val.length === 1) {
    // special case: we have specified only one item in the expected body,
    // but what we really want is to check all of the returned items so
    // fill the expected array with as many items as the returned one
    if (resVal.length < 1) {
      throw new assert.AssertionError({
        message: `Expected more then one element in the field: ${key}`,
      });
    }
    arrVal = [];
    while (arrVal.length < resVal.length) {
      arrVal.push(val[0]);
    }
  } else {
    arrVal = val;
  }
  assert.deepEqual(
    arrVal.length, resVal.length,
    `Different size of array for field ${key}, expected ${arrVal.length
    } actual ${resVal.length}`
  );
  arrVal.forEach((item, index) => {
        validateBody(resVal[index], item); // eslint-disable-line
  });
}

function validateBody(resBody, expBody) {
    if (!expBody) { return true; } // eslint-disable-line
    if (!resBody) { return false; } // eslint-disable-line

  if (Buffer.isBuffer(resBody)) {
    // eslint-disable-next-line
    resBody = resBody.toString();
  }
  if (expBody.constructor !== resBody.constructor) {
    if (expBody.constructor === String) {
      // eslint-disable-next-line
      resBody = JSON.stringify(resBody);
    } else {
      // eslint-disable-next-line
      resBody = JSON.parse(resBody);
    }
  }
  if (expBody.constructor === Object) {
    Object.keys(expBody).forEach((key) => {
      const val = expBody[key];
      // eslint-disable-next-line
            assert.deepEqual(resBody.hasOwnProperty(key), true, `Body field ${key} not found in response!`);
      if (val.constructor === Object) {
        validateBody(resBody[key], val);
      } else if (val.constructor === Array) {
        validateArray(val, resBody[key], key);
      } else {
        cmp(resBody[key], val, `${key} body field mismatch!`);
      }
    });
  } else if (Array.isArray(expBody)) {
    validateArray(expBody, resBody, 'body');
  } else {
    cmp(resBody, expBody, 'Body mismatch!');
  }
  return true;
}

function validateTestResponse(testCase, res) {
  const expRes = testCase.response;

  assert.deepEqual(res.status, expRes.status);

  if (expRes.headers && !res.headers) {return false; } // eslint-disable-line

  Object.keys(expRes.headers).forEach((key) => {
    const val = expRes.headers[key];
    // eslint-disable-next-line
        assert.deepEqual(res.headers.hasOwnProperty(key), true, `Header ${key} not found in response!`);
    cmp(res.headers[key], val, `${key} header mismatch!`);
  });

  return validateBody(res.body || '', expRes.body);
}

describe('Swagger spec', () => {
  jest.setTimeout(20000);
  spec = yaml.safeLoad(fs.readFileSync(`${__dirname}/../../../spec.yaml`));

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  it('get the spec', async () => {
    baseUrl = server.config.uri;
    const res = await preq.get(`${baseUrl}?spec`);
    assert.status(res, 200);
    assert.contentType(res, 'application/json');
    assert.notDeepEqual(res.body, undefined, 'No body received!');
  });

  describe('test spec x-amples', () => {
    constructTests(spec).forEach((testCase) => {
      it(testCase.title, async () => {
        try {
          const res = await preq(testCase.request);
          assert.status(res, testCase.response.status);
          validateTestResponse(testCase, res);
        } catch (err) {
          assert.status(err, testCase.response.status);
          validateTestResponse(testCase, err);
        }
      });
    });
  });

  it('should expose valid OpenAPI spec', () => preq.get({ uri: `${server.config.uri}?spec` })
    .then((res) => {
      assert.deepEqual({ errors: [] }, validator.validate(res.body), 'Spec must have no validation errors');
    }));

  it('spec validation', () => {
    // check the high-level attributes
    ['info', 'swagger', 'paths'].forEach((prop) => {
      assert.deepEqual(!!spec[prop], true, `No ${prop} field present!`);
    });
    // no paths - no love
    assert.deepEqual(!!Object.keys(spec.paths), true, 'No paths given in the spec!');
    // now check each path
    Object.keys(spec.paths).forEach((pathStr) => {
      assert.deepEqual(!!pathStr, true, 'A path cannot have a length of zero!');
      const path = spec.paths[pathStr];
      assert.deepEqual(!!Object.keys(path), true, `No methods defined for path: ${pathStr}`);
      Object.keys(path).forEach((method) => {
        const mSpec = path[method];
        if ({}.hasOwnProperty.call(mSpec, 'x-monitor') && !mSpec['x-monitor']) {
          return;
        }
        validateExamples(pathStr, spec['x-default-params'] || {}, mSpec['x-amples']);
      });
    });
  });
});
