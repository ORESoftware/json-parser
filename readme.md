
## @oresoftware/json-stream-parser

[![Version](https://img.shields.io/npm/v/@oresoftware/json-stream-parser.svg?colorB=green)](https://www.npmjs.com/package/@oresoftware/json-stream-parser)


### Transform stream

>
>  Transforms JSON stream to JS Objects
>

### Installation

```bash

$ npm i -S '@oresoftware/json-stream-parser'

```

### Import

```js

import {JSONParser} from '@oresoftware/json-stream-parser';

```


## Examples

Simple bash example:

```js

const k = cp.spawn('bash');
k.stdin.end(`echo '{"foo":"bar"}\n'`);

k.stdout.pipe(new JSONParser()).on('data', d => {
  // => {foo:'bar'}
});

```

Bash example with bash variables:

```js

const k = cp.spawn('bash');

k.stdin.end(`

  foo="medicine"
  cat <<EOF\n{"foo":"$foo"}\nEOF

`);

k.stdout.pipe(new JSONParser()).on('data', d => {
  
    assert.deepStrictEqual(d, {foo: 'medicine'});
  
});


```

Note that the json-stdio NPM package uses json-stream-parser, for an example:

https://github.com/ORESoftware/json-stdio/blob/dev/src/index.ts#L109
