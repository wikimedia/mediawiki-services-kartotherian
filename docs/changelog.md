# Changelog

## As of 2022-07-26
Changes done as part of the
[GeoInfo focus area](https://phabricator.wikimedia.org/tag/wmde-geoinfo-focusarea/)
by the Wikimedia Deutschland Technical Wishes team.

* The Kartotherian codebase is now a monolith that contains many of the
  libraries that have been hosted in separate code repositories before.
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
* Added revision support
    * Pass revid parameter through to mapdata
* Added a "geopoint" service
    * Geopoints via sparql
    * Added QID input for GeoPoints
    * Make coordinate predicate id configurable
* Improved support for Wikidata items or query results with multiple coordinates
    * Store ids as a Set
    * Treat rows independently rather than keying by QID
    * Only use first wikidata query result for the same item
* Pin to makizushi with older icons
* Filter out points from geoshape and geoline query
* Send a consistent User-Agent header
* kartodock config stored with source
