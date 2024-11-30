#!/bin/bash

set -ex

cd /srv/app
/usr/bin/git submodule update --init --recursive
