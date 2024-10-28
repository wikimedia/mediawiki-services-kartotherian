#!/bin/bash

set -ex

cd /srv/app
/usr/bin/git submodule update --init --recursive
cd vendor/mapnik
/usr/bin/python3 ./scons/scons.py configure PREFIX=/opt/lib/mapnik
/usr/bin/python3 ./scons/scons.py install -j8
