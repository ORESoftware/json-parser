#!/usr/bin/env node
'use strict';

import {JSONParser} from './index';

// example use:  echo '{"foo":"bar", "zoo": {"star":3}}' | json_parser

// example output line 1: 'foo' '"bar"'
// example output line 2: 'zoo' '{"star":3}'

// it's always a tuple, key value, for top-level keys
// the key is always a string, the value is always a string parseable by JSON.parse().

process.stdin.resume().pipe(new JSONParser({debug:true})).on('data', (d:any) => {
  
  if(!(d && typeof d === 'object')){
    console.error('json-parser: parsed value was not an object:', d);
    return;
  }
  
  return Object.keys(d).forEach(k => {
    console.log(`'${k}'`, `'${JSON.stringify(d[k])}'`);
  });
  
});
