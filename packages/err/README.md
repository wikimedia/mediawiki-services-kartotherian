[![Build Status](https://travis-ci.org/kartotherian/err.svg?branch=master)](https://travis-ci.org/kartotherian/err)

# @wikimedia/err
A generic exception with parameter formatting and an optional metrics param

```
let Err = require('@wikimedia/err');

throw new Err('Invalid value %d', 10).metrics('wrong-value');
```
