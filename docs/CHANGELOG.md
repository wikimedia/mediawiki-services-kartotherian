# Change log

Changes done as part of the
[GeoInfo focus area](https://phabricator.wikimedia.org/tag/wmde-geoinfo-focusarea/)
by the Wikimedia Deutschland Technical Wishes team.

### As of October 2022

* [T319283](https://phabricator.wikimedia.org/T319283): Ignore SPARQL results with some-value/no-value
* [T317766](https://phabricator.wikimedia.org/T317766): Include some documentation about the StatsD metrics emitted
* [T312913](https://phabricator.wikimedia.org/T312913): Added lots of error logging
    * Log failing promises everywhere
    * Log when geoshape/geoline requests return empty data
    * Use mapdata v0.7.2 including bugfix and more logging
* Updated libraries
    * Use [@wikimedia/mapdata](https://www.npmjs.com/package/@wikimedia/mapdata) library version 0.7.0
    * Use [@wikimedia/makizushi](https://www.npmjs.com/package/@wikimedia/makizushi) version 4.0.0

### As of May 2022

#### User-facing
* [T293844](https://phabricator.wikimedia.org/T293844): Added revision support
  specifically to support WMF wikis with the
  [Flagged Revisions extension](https://www.mediawiki.org/wiki/Extension:FlaggedRevs)
    * Pass revid parameter through to mapdata
* [T307695](https://phabricator.wikimedia.org/T307695): Added a "geopoint"
  service
    * Geopoints via SPARQL
    * Added QID input for GeoPoints
    * Make coordinate predicate id configurable
* [T306540](https://phabricator.wikimedia.org/T306540): Improved support for
  Wikidata items or query results with multiple coordinates
    * Store ids as a Set
    * Treat rows independently rather than keying by QID
    * Only use first wikidata query result for the same item
* [T292613](https://phabricator.wikimedia.org/T292613): Filter out points from
  geoshape and geoline query

#### Technical
* [T262523](https://phabricator.wikimedia.org/T262523): The Kartotherian
  codebase is now a monolith that contains many of the libraries that have been
  hosted in separate code repositories before.
    * Convert kartotherian from a monorepo
    * Move autogen into monolith
    * Move babel into monolith
    * Move err into monolith
    * Move geoshapes into monolith
    * Move input-validator into monolith
    * Move kartotherian-core into the monolith
    * Move maki into monolith
    * Move module-loader into monolith
    * Move overzoom into monolith
    * Move server into monolith
    * Move snapshot into monolith
    * Move substantial into monolith
* [T300040](https://phabricator.wikimedia.org/T300040): Pin to makizushi with
  older icons
* Send a consistent User-Agent header
* [T302292](https://phabricator.wikimedia.org/T302292): kartodock config stored
  with source
