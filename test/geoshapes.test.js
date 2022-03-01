const GeoShapes = require('../lib/geoshapes/geoshapes');

describe('wrapResult', () => {
  test('converts point to geojson', () => {
    const shape = new GeoShapes('geoshape', { query: 'dummy' }, { wikidataQueryService: true });

    shape.geoRows = [
      {
        id: 'dummy',
        data: JSON.stringify({
          type: 'Point',
          coordinates: [0, 0],
        }),
      },
    ];
    const result = shape._wrapResult();
    const expectedResult = {
      type: 'Topology',
      objects: {
        data: {
          type: 'GeometryCollection',
          geometries: [
            {
              coordinates: [
                0,
                0,
              ],
              id: 'dummy',
              properties: {},
              type: 'Point',
            },
          ],
        },
      },
      arcs: [],
      bbox: [0, 0, 0, 0],
    };
    expect(result).toStrictEqual(expectedResult);
  });
});
