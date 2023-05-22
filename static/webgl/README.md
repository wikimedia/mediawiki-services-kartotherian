# Testing the WebGL renderer with maplibre

**Attention:** the `index.html` is not going to work in a production environment and is not supposed to. This is just for local testing purposes.

## Prerequisites
- Override `config.docker.yaml` csp option with an empty string

```
services:
  - name: kartotherian
    # a relative path or the name of an npm package, if different from name
    module: ./app.js
    # optionally, a version constraint of the npm package
    # version: ^0.4.0
    # per-service config
    conf:
    [ ... ]
-->   csp: ''
    [ ... ]
```
