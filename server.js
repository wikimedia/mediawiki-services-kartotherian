#!/usr/bin/env node

// Service entry point. Try node server --help for commandline options.

// Start the service by running service-runner, which in turn loads the config
// (config.yaml by default, specify other path with -c). It requires the
// module(s) specified in the config 'services' section (app.js in this
// example).
'use strict';

const ServiceRunner = require( 'service-runner' );

new ServiceRunner().start();
