# Kartotherian

Kartotherian is a map tile service originally built for the [Wikimedia](https://www.wikimedia.org/) projects.  Kartotherian ties together various open source modules from the [TileLive](https://github.com/mapbox/tilelive) ecosystem, thereby providing for serving tiles from a variety of sources.

This version supports Node.js 10+.

# Maps Tile service for Wikipedia

This code is cross-hosted at [gerrit](https://gerrit.wikimedia.org/g/mediawiki/services/kartotherian/)

Maps nodejs server for vector-based tiles and snapshots, designed for Wikipedia and other sites. It ties together a number of [MapBox](https://github.com/mapbox) components for vector and raster rendering based on [Mapnik 3](https://github.com/mapnik/mapnik), and uses [service runner](https://github.com/wikimedia/service-runner) for scalability, performance monitoring and stability.

### Serving tiles
Kartotherian can serve vector and raster tiles in multiple formats and optional scaling:

    http://.../{source}/{zoom}/{x}/{y}[@{scale}x].{format}

* The sources are configured with the source config file. Sources configuration supports different methods of tile storage, such as HTTP or files, generation from postgress db, overzoom to extract the tile from lower zooms if missing, layer extraction, mixing multiple sources together, etc.
* Optional scalling can render larger images for high resolution screens (only those enabled in the source, e.g. `[1.5, 2]`)
* Supported formats include PNG ang JPEG, SVG, PBF vectors, and JSON (with `nogeo` and `summary` debug options)

### Static map images
Kartotherian supports static image generation. Users may request a PNG or a JPEG snapshot image of any size, scaling, and zoom level:

    http://.../img/{source},{zoom},{lat},{lon},{width}x{height}[@{scale}x].{format}

    # image centered at 42,-3.14, at zoom level 4, size 800x600
    http://.../img/osm-intl,4,42,-3.14,800x600.png

    # the same but for higher DPI device with 1.5 scaling
    http://.../img/osm-intl,4,42,-3.14,800x600@1.5x.png

### Info data
Kartotherian can be used as a source of the PBF data for Mapbox studio. See info about style editing in  [osm-bright-source](https://github.com/kartotherian/osm-bright.tm2/blob/master/README.md). The info data is available at `http://.../{style}/pbfinfo.json` for pbf source, and `http://.../{style}/info.json` for the styled image source.

### Markers
Kartotherian can generate marker images by wrapping any of the [maki icons](https://www.mapbox.com/maki/) with a pushpin image, in any color. The URL schema is matched to the one used by the [mapbox.js](https://github.com/mapbox/mapbox.js).

    http://.../v4/marker/pin-l-cafe+de00ff@2x.png
    http://.../v4/marker/ {base} - {size:s|m|l} [-{letter-or-digit-or-icon-name}] + {color} [@2x] .png

At this point, only "pin" is supported for the base. The color is a 3 digit or 6 digit hex number. Optional scaling can only be 2x. Beyond the pre-defined maki icons, you may give a number (0-99), a single letter (a-z), or nothing.

## Very quick start

```
git clone https://github.com/kartotherian/kartotherian.git  # Clone the repository
cd kartotherian
```

```
npm install
node server.js -c config.external.yaml
```

Browse to http://localhost:6533/
The set up inside [`sources.external.yaml`](sources.external.yaml) does not use any storage or caching, so it will not be suitable for production. You will need to to set up your own local database as described in [osm-bright.tm2source](https://github.com/kartotherian/osm-bright.tm2source), which is installed in `node_modules/osm-bright-source`, and configure additional source chains and setup a proper storage to make this into a production system.


## Configuration
Inside the `conf` key:
* `sources` - (required) Either a set of subkeys, a filename, or a list of file names.  See below on how to configure the sources.
* `variables` (optional) - specify a set of variables (string key-value pairs) to be used inside sources, or it could be a filename or a list of filenames/objects.
* `defaultHeaders` (optional, object) - a set of extra headers that will be sent to the user unless the source provides its own. (public requests only)
* `headers` (optional, object) - a set of extra headers that will be sent to the user instead of the headers returned by the source. (public requests only)

For the rest of the configuration parameters, see [service runner](https://github.com/wikimedia/service-runner) config info.

## Components
Kartotherian platform consists of a number of elements, some of which conform to the general specifications established
by [MapBox](https://github.com/mapbox), and therefor can reuse components that confirm to the same specification.

### Components by Wikimedia Foundation

* `core` - Loads and configures tile sources, and provides some common utility functions
* server - Handles user web requests for tiles and source info, as well as registers additional data type handlers like maki markers and image snapshots.
* maki - Request handler for maki markers, generates PNG marker images that can be used from geojson.
* snapshot - Request handler for static images by combining multiple tiles into one snapshot image of a requested size, with optional geojson overlays based on mapdata stored in MediaWiki.

#### babel
Tile source to restructure vector PBFs for multilingual usecases, such as convert a single JSON object into multiple key/values, or to replace all language key/value names with a single one.  

##### Usage examples

Tile is generated with 'name_' field set a JSON-encoded key-value object.
Babel can be used to convert that tile to a tile, with each value in the object becoming
a tag of its own, e.g. 'name_en', 'name_fr', ... . Also, babel can be used to replace
multiple 'name_lang' tags with a single 'name_' tag right before rendering it, choosing the best
language based on the fallback rules, but only if it is different from the 'name' tag.

```yaml
# Process tiles from 'gen' source, expanding json string into multiple tags
json2tags:
  uri: json2tags://
  params:
    source: {ref: gen}
    tag: name   # optional, 'name' is the default
```


```yaml
# Process tiles from 'store' source, replacing all 'name_*' tags with a single 'name' tag
babel:
  uri: babel://
  params:
    source: {ref: store}
    
    # optional, 'name' is the default
    tag: name
    
    # optional, used by default if no 'lang' code is passed to getAsync()
    defaultLanguage: 'en' 
    
    # optional map of fallback values. Can be a json file or an object value
    languageMap: '/my/path/fallback.json'
    
    # -- OR --
    
    languageMap:
      en: ['fr', 'es', 'de']
      ru: ['be']
```

##### Language resolution
For `babel://`, the language of the `name_` is chosen based on these rules:

`getAsync({z,x,y, lang:'xx')`:
 * `name_xx`
 * Use explicitly set fallbacks from the languageMap
 * Use any `name_yy-Script` where `Script` is the script of `xx`. E.g. if `lang=ru`, pick any `lang_yy-Cyrl`.
 * If `xx` uses the Latin script, use any `name_zz_rm`
 * `name`

##### Scripts

Babel gets the CLDR defined script name (Latn, Cyrl, ... ) based on the language code. It also uses a few overrides from the `overrides.json`. This file should be updated with any language IDs found in OSM data.

#### core

##### Sources
Sources is a way to set up data processing pipelines for Kartotherian. Any source based on  [tilelive.js](https://github.com/mapbox/tilelive#tilelivejs) specification may be used.
Source configuration could be located in standalone files, or be embedded in the
main configuration file, or a mix of both. The sources value in the config file
could be a string (file), an object defining the source, or an array of strings and objects.

`uri` is the only mandatory field, and it specifies how [tilelive.js](https://github.com/mapbox/tilelive#tilelivejs)
will locate and initialize the new source. The protocol determines which tile provider will be used.

Since sometimes not everything can be added as query parameters to the URI, there is a set of additional keys to help.
Values can either be hardcoded as strings/numbers/booleans, or can be calculated on the fly.

A simple source configuration to set up a tile storage as files in the ./vectors dir:
```
filestore:
    uri: file://./vectors
```
The path can also be set via a parameter:
```
filestore:
    uri: file://
    pathname: ./vectors
```
The value does not have to be given in the source, but instead could be dynamically generated.
For example, the `env` uses an environment variable, and the `var` generator pulls the value from the variable store.
The variables are defined in a separate file(s), similar to sources.
```
filestore:
    uri: file://
    pathname: {env: KARTOTHERIAN_PATH}  # Uses an environment variable
      # or
    pathname: {var: tilepath}  # Uses a variable named tilepath
```

More parameters can be set using `params` - a set of additional values to be set in URI:
```
oz:
  # "overzoom:" is a tile source that will attempt to get a tile from another source,
  # and if tile is missing, attempt to get a portion of the lower-zoom tile.
  uri: overzoom://
  # Specify the tile source - this adds a properly escaped query parameter
  #   ?source=sourceref:///?ref=gen
  param:
    source: {ref: gen}
```

##### Value substitutions

In general, these value substitutions are available:
* `{env: envVarName}` - the value becomes the value of the environment variable `envVarName`. This might be useful if you want to make all the settings public except for the passwords that are stored in a secure location.
* `{var: varName}` - the value becomes the value of the variable `varName` from the variables file / variables conf section of the main config file. This might be useful if you want to make all the settings public except for the passwords that are stored in a secure location.
* `{ref: sourceId}` - the value becomes a reference to another source. Some sources function as filters/converters, pulling data internally from other sources and converting the result on the fly. For example, the [overzoom](https://github.com/kartotherian/overzoom) source pulls data from another source, and if it's not available, tries to find a lower-zoom tile above the given one, and extract a portion of it. Internally, it uses a forwarding sourceref: source.
* `{npmloader: npm-module-name}` or `{npmloader: ['npm-module-name', 'arg1', 'arg2', ...]}` - if npm module supports loading customization, it should be loaded via the npmloader. Npmloader is only available inside the source's `xml` key.
* `{npmpath: ['npm-module-name', 'subdir', 'subdir', 'filename']}` - some files may be located inside the NPM modules added to the Kartotherian project, i.e. [osm-bright-source](https://github.com/kartotherian/osm-bright.tm2source). To reference a file inside npm, set npm's value to an array, with the first value being the name of the npm module (resolves to the root of the npm module), and all subsequent strings being subdirs and lastly - the name of the file. Subdirs may be omitted. `npmpath: ["osm-bright-source", "data.xml"]` would resolve to a rooted path `/.../node_modules/osm-bright-source/data.xml`

##### XML-based sources
The `xml` parameter is used to load and alter XML for some sources like
[tilelive-bridge](https://github.com/mapbox/tilelive-bridge) (SQL→VectorTile or TIFF→RasterTile) and
[tilelive-vector](https://github.com/mapbox/tilelive-vector) (Style VectorTile → PNG).
The `xml` field must evaluate to the xml file path.

```
gen:                # The name of the source (could be referenced later)
  uri: bridge://    # Required - the URI used to construct the source
  xml:              # Init source with this xml instead of the URI's other parameters
    # Set xml to the location of the 'data.xml', which is located inside the osm-bright-source npm
    npmpath: ["osm-bright-source", "data.xml"]
  xmlSetDataSource: # Before loading, update the datasource section of the standard mapnik config file
    if:             # Only update datasources that match all these values (logical AND)
      dbname: gis   # Instead of 'gis', you can use {npmpath:...}, {ref:..}, and {var:...}
      host: ''
      type: postgis
    set:            # Replace these keys with the new values
      host: localhost
      user: {var: osmdb-user}  # Instead of hardcoding, use the value from the variables file or conf section
      password: {var: osmdb-pswd}
```

* `xmlSetAttrs` - for xml, overrides the attributes of the root element with the new ones. For example, you may change the font directory of the `<Map>` element:
```
s2:
  uri: vector://
  xml:
    npmloader: osm-bright-style    # stylesheet xml is in npm
  xmlSetAttrs:
    # Note that this is not needed for osm-bright-style because that module does this internally
    font-directory: {npmpath: ["osm-bright-fonts", "fonts/"]}
```
* `xmlSetParams` - for xml, overrides the top level `<Parameters>` values with the new ones. For example, the `vector` source requires xml stylesheet to point to the proper source of PBFs:
```
s2:
  public: true
  uri: vector://
  formats: [png,json,headers,svg,jpeg]
  xml:
    npmloader: osm-bright-style    # stylesheet xml is in npm
  xmlSetParams:
    source: {ref: gen}                          # set source parameter to the 'gen' source
```
* `xmlLayers` - keep all non-layer data, but only keep those layers that are listed in this value (whitelist):
```
s2:
  public: true
  uri: vector://
  formats: [png,json,headers,svg,jpeg]
  xml:
    npmloader: osm-bright-style    # stylesheet xml is in npm
  xmlLayers: ['landuse', 'road']                # Only include these layers when rendering
```
* `xmlExceptLayers` - same as `xmlLayers`, but instead of whitelisting, blacklist (allow all except these):
```
s2:
  public: true
  uri: vector://
  formats: [png,json,headers,svg,jpeg]
  xml:
    npmloader: osm-bright-style    # stylesheet xml is in npm
  xmlExceptLayers: ['water']                    # Exclude water layer when rendering
```
* `xmlSetDataSource` - change all layer's datasources' parameters if they match conditions:
`if` is a set of parameter values that all must match,
`xmlLayers` and `xmlExcludeLayers` just like above set which layers to address,
and `set` specifies the new parameter values to be set.

Instead of an object, `xmlSetDataSource` can be set to an array of objects to provide
multple change sets.

##### Kartotherian-specific parameters:

* `public` (boolean) - should this be source be accessible via `/<sourceId>/z/x/y.format` requests. You may also set configuration parameter `allSourcesPublic` to true to make all sources public (might be dangerous)
* `minzoom` (int) - minimum allowable zoom for the public request (public requests only)
* `maxzoom` (int) - maximum allowable zoom for the public request (public requests only)
* `defaultHeaders` (object) - a set of extra headers that will be sent to the user unless the source provides its own. (public requests only)
* `headers` (object) - a set of extra headers that will be sent to the user instead of the headers returned by the source. (public requests only)
* `formats` (array of strings) - one string or a list of string values specifying allowed formats, e.g. `['png','jpeg']`
* `scales` (array of numbers) - one number or a list of number values specifying allowed scalings, e.g. `[1.3, 1.5, 2, 2.6, 3]`
* `setInfo` (object) - provide values that will be reported to the client via the `/<sourceId>/info.json`. See https://github.com/mapbox/tilejson-spec
* `overrideInfo` (object) - override values produced by the source's getInfo(), or if value is null, remove it. Result will be accessible via `/<sourceId>/info.json`. See https://github.com/mapbox/tilejson-spec

# geoshapes
Kartotherian service to generate geometric shapes from PostgreSQL data

See https://github.com/kartotherian/kartotherian

To configure, add `geoshapes` section to the kartotherian configuration with the following parameters:

```
geoshapes:
  host: localhost
  database: gis
  table: planet_osm_polygon
  user: ...
  password: ...

  maxidcount: (int, optional, default=500) - Maximum number of IDs to allow per request
  allowUserQueries: (bool, optional, default=false) - If true, allow sql parameter + args to specify which SQL to use
  wikidataQueryService: (string, optional, default=https://query.wikidata.org/bigdata/namespace/wdq/sparql) - Lets user get a list of WikidataIDs from an external Wikidata Query Service. if false, disables.
```

Without this config block, the service will skip its loading

Make sure to create a Postgres index, e.g.:
```
CREATE INDEX planet_osm_polygon_wikidata
  ON planet_osm_polygon ((tags -> 'wikidata'))
  WHERE tags ? 'wikidata';
```

Service will return topojson to the queries such as `/geoshape?ids=Q1384,Q1166`  (get New York and Michigan state shapes).
Save result as a file and upload to http://www.mapshaper.org/ to visualize.

Additionally, the service allows `query=...` parameter to get the Wikidata IDs from the http://query.wikidata.org service. It calls the service to execute
a query, extracts IDs, and matches them with the shapes in the OSM database. All other values are returned as topojson object properties.

Optional truthy parameter `getgeojson=1` will force the result to be returned as geojson rather than topojson.

#### Tile sources

* [kartotherian-autogen](https://github.com/kartotherian/autogen) - Tile source that checks "storage" source for a tile, and if not found, gets it from the "generator" source and saves it into the "storage"
* [kartotherian-demultiplexer](https://github.com/kartotherian/demultiplexer) - Tile source that combines multiple sources by zoom level
* [kartotherian-overzoom](https://github.com/kartotherian/overzoom) - Tile source that will zoom out if the requested tile does not exist, and extracts the needed portion from the lower-zoom tile it finds.
* substantial - A filtering tile source for Kartotherian map tile server that only lets through tiles that have complex data, and should be saved to a database. Tiles that only contain one layer like water could be easily extracted from lower-level zoom (overzooming).

#### Data and Styling

* [osm-bright-source](https://github.com/kartotherian/osm-bright.tm2source) - SQL queries used by the `tilelive-bridge` to generate a vector tile from Postgres Database
* [osm-bright-style](https://github.com/kartotherian/osm-bright.tm2) - Style used by the `tilelive-vector` to convert vector tiles into images.
* [osm-bright-fonts](https://github.com/kartotherian/osm-bright.fonts) - Fonts used by the `osm-bright-style`.


### Components by MapBox

* [tilelive](https://github.com/mapbox/tilelive) - ties together various tile sources, both vector and raster
* [tilelive-bridge](https://github.com/mapbox/tilelive-bridge) - generates vector tiles from SQL
* [tilelive-vector](https://github.com/mapbox/tilelive-vector) - converts vector tiles to raster tiles
* [abaculus](https://github.com/mapbox/abaculus) - generates raster images of any location and size from a tile source

### Other Relevant Components

* [mapnik](https://github.com/mapnik/node-mapnik) - Tile rendering library for node
* [leaflet](https://github.com/Leaflet/Leaflet) - JavaScript library for mobile-friendly interactive maps

## In depth step-by-step:

This documentation assumes that you are going to use [osm-bright.tm2](https://github.com/kartotherian/osm-bright.tm2) and [osm-bright.tm2source](https://github.com/kartotherian/osm-bright.tm2source) for a map style.

### Install node.js and npm

Node.js v6 or v8 required; v10+ currently not supported.

For Windows and Mac, downloadable installers can be found at https://nodejs.org/download/release/latest-v6.x/ or https://nodejs.org/download/release/latest-v8.x/.

For Linux, installation via the instructions at https://nodejs.org/en/download/package-manager/ is recommended.

### Install other software dependencies

On Ubuntu these can be installed with
```
sudo apt-get install git unzip curl build-essential sqlite3 pkg-config libcairo2-dev libjpeg-dev libgif-dev libmapnik-dev
```

### Clone the repo and install npm dependencies

```
git clone https://github.com/kartotherian/kartotherian.git
cd kartotherian
npm install
```

### Source

Set up osm-bright.tm2source as described in [its documentation.](https://github.com/kartotherian/osm-bright.tm2source#install).

osm-bright.tm2source is installed in `node_modules/osm-bright-source`

### Edit Kartotherian configuration - config.yaml
```
# 0 - one instance, 1+ - multi-instance with autorestart, ncpu - multi-instance, one per CPU
num_workers: 0

# Host port
port: 6533

# Comment out this line to listen to the web
# interface: localhost

# Place all variables (e.g. passwords) here - either as a filename, or as sub-items.
variables:

# Place all sources you want to serve here - either as a filename, or as sub-items.
# See sources.prod.yaml for examples
sources: sources.yaml
```

### Configure Kartotherian
Use one of the config files, or update them, and make a link config.yaml to it.

### Add Varnish caching layer (optional)
Might require caching headers added to the source/config.
```
# From https://www.varnish-cache.org/installation/debian
sudo -Hi
apt-get install apt-transport-https
curl https://repo.varnish-cache.org/GPG-key.txt | apt-key add -
echo "deb https://repo.varnish-cache.org/debian/ jessie varnish-4.0" >> /etc/apt/sources.list.d/varnish-cache.list
apt-get update
apt-get install varnish

vi /etc/varnish/default.vcl
```
Change default backend to:
```
backend default {
    .host = "localhost";
    .port = "6533";
}
```
Add this to vcl_deliver (to track hits/misses):
```
if (obj.hits > 0) {
    set resp.http.X-Cache = "HIT";
} else {
    set resp.http.X-Cache = "MISS";
}
```
Edit /etc/systemd/system/varnish.service - set proper listening port (80) and cache size:
```
ExecStart=/usr/sbin/varnishd -a :80 -T localhost:6082 -f /etc/varnish/default.vcl -S /etc/varnish/secret -s malloc,4g
```
In bash:
```
systemctl daemon-reload  # because we changed the .service file
systemctl restart varnish.service
systemctl status varnish.service  # check the service started with the right params
varnishstat  # monitor varnish performance
```

### Run Karthotherian:
```
npm start
```
In browser, navigate to `http://localhost:6533/`.

### Troubleshooting

In a lot of cases when there is an issue with node it helps to recreate the
`node_modules` directory:
```
rm -r node_modules
npm install
```
