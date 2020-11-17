# Maps Data Flow

Kartotherian uses data from OSM database, from the OSM sync data until it's served, the data flow follow some specfic pipelines:

## Incoming
### OSM sync data flow

![OSM sync data flow](./diagrams/output/osmSyncDataFlow.png)

### Tile generation data flow

![Tile generation data flow](./diagrams/output/tileGenerationDataFlow.png)

## Outgoing

### Tile server data flow

![Tile server data flow](./diagrams/output/tileRequestDataFlow.png)

### Static Map request data flow
![Snapshot data flow](./diagrams/output/geoshapesRequestDataFlow.png)

### geoshapes GeoJSON request data flow
![Geoshapes data flow](./diagrams/output/staticMapRequestDataFlow.png)
