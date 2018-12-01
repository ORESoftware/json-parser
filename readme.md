
## @oresoftware/json-stream-parser


### Transform stream

>
>  Transforms JSON stream to JS Objects
>


## Examples


```js

const k = cp.spawn('bash');
k.stdin.end(`echo '{"foo":"bar"}'`);

k.stdout.pipe(new JSONParser()).on('data', d => {
  // => {foo:'bar'}
});

```
