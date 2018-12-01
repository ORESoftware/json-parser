
## @oresoftware/json-stream-parser

[![Version](https://img.shields.io/npm/v/@oresoftware/json-stream-parser.svg?colorB=green)](https://www.npmjs.com/package/@oresoftware/json-stream-parser)


### Transform stream

>
>  Transforms JSON stream to JS Objects
>


## Examples


```js

const k = cp.spawn('bash');
k.stdin.end(`echo '{"foo":"bar"}\n'`);

k.stdout.pipe(new JSONParser()).on('data', d => {
  // => {foo:'bar'}
});

```
