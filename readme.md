
## @oresoftware/json-stream-parser

[![Version](https://img.shields.io/npm/v/@oresoftware/json-stream-parser.svg?colorB=green)](https://www.npmjs.com/package/@oresoftware/json-stream-parser)


### Transform stream

>
>  Transforms JSON stream to JS Objects
>

### Installation

```bash

$ npm install '@oresoftware/json-stream-parser'

```

### Import

```js

import {JSONParser} from '@oresoftware/json-stream-parser';

```

### Usage

Right now, the library assumes each separate chunk of json is separated by newline characters. <br>
In the future, we could attempt to use a different delimiting character, as a user-provided input variable. <br>
Recommendations welcome.


## Examples

#### Simple Node.js example:

###### Reading from stdin

```typescript

process.stdin.resume().pipe(new JSONParser()).on('data', d => {
  // now we got some POJSOs!
});

```

###### Reading/writing to a tcp socket

```typescript

import * as net from 'net';
const [port,host] = [6970,'localhost'];
const ws = net.createConnection(port, host);

ws.setEncoding('utf8')
  .pipe(new JSONParser())   // tcp connection is bidirection/full-duplex .. we send JSON strings each way
  .on('data', onData);    // we receive data coming from the tcp server here


// and we send data like this:
ws.write(JSON.stringify({'some':'data'}) + '\n', 'utf8', cb); // make sure to include the newline char when you write

```

#### Using bash shell

###### Simple bash example:

```js

const k = cp.spawn('bash');
k.stdin.end(`echo '{"foo":"bar"}\n'`);  // make sure to include the newline char when you write

k.stdout.pipe(new JSONParser()).on('data', d => {
  // => {foo:'bar'}
});

```

###### Bash example with bash variables:

```js

const k = cp.spawn('bash');

k.stdin.end(`

  foo="medicine"
  cat <<EOF\n{"foo":"$foo"}\nEOF  # make sure to include the newline char when you write

`);

k.stdout.pipe(new JSONParser()).on('data', d => {
  
    assert.deepStrictEqual(d, {foo: 'medicine'});
  
});


```

### If your JSON has white space (newlines etc)

If you JSON has unescaped newlines, then use the delimiter option.

```js
new JSONParser({delimiter: '∆∆∆'});  // use 3 alt-j's to separate json chunks, since newlines won't work

```


