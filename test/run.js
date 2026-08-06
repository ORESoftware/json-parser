#!/usr/bin/env node
'use strict';

import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { performance } from 'node:perf_hooks';

import {
  JSONParser,
  LiveMutexJSONParser,
  createLiveMutexJSONParser,
  defaultLiveMutexJSONParseDelayEvery,
  RawStringSymbol,
  RawJSONBytesSymbol
} from '../dist/main.js';

async function collectStream(readable) {
  return await new Promise((resolve, reject) => {
    const out = [];
    readable.on('data', v => out.push(v));
    readable.on('error', reject);
    readable.on('end', () => resolve(out));
  });
}

async function test(name, fn) {
  try {
    await fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    process.stderr.write((err && err.stack) ? (err.stack + '\n') : String(err) + '\n');
    process.exitCode = 1;
  }
}

async function parseChunks(ParserClass, opts, chunks) {
  const p = new ParserClass(opts);
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));

  for (let i = 0; i < chunks.length - 1; i++) {
    input.write(chunks[i]);
  }

  input.end(chunks[chunks.length - 1]);
  return await outP;
}

async function benchmarkParser(ParserClass, opts, payload) {
  const start = performance.now();
  const out = await parseChunks(ParserClass, opts, [payload]);
  return {
    out,
    ms: performance.now() - start
  };
}

await test('parses newline-delimited JSON objects', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}\n{"b":2}\n');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('parses JSON split across stream chunks', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.write('{"a":');
  input.end('1}\n{"b":2}\n');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('parses CRLF-delimited JSONL input', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}\r\n{"b":2}\r\n');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('skips empty JSONL records between delimiters', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('\n{"a":1}\n\n{"b":2}\n');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('parses JSONL arrays and primitive values', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('[1,2]\ntrue\n"hello"\n42\n');
  const out = await outP;
  assert.deepEqual(out, [[1, 2], true, 'hello', 42]);
});

await test('parses final JSON chunk without trailing delimiter (flush)', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"z":9}');
  const out = await outP;
  assert.deepEqual(out, [{ z: 9 }]);
});

await test('supports custom delimiter', async () => {
  const p = new JSONParser({ delimiter: '∆∆∆' });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}∆∆∆{"b":2}∆∆∆');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('supports multi-char delimiter with no trailing delimiter (flush)', async () => {
  const p = new JSONParser({ delimiter: '<<<>>>' });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}<<<>>>{"b":2}');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('custom delimiter works even when JSON contains newlines (escaped)', async () => {
  const p = new JSONParser({ delimiter: '∆∆∆' });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  // newline is escaped inside JSON string; parser should split only on delimiter
  input.end('{"msg":"hello\\nworld"}∆∆∆{"msg":"bye\\nnow"}∆∆∆');
  const out = await outP;
  assert.deepEqual(out, [{ msg: 'hello\nworld' }, { msg: 'bye\nnow' }]);
});

await test('custom delimiter works when delimiter is split across stream chunks', async () => {
  const p = new JSONParser({ delimiter: '∆∆∆' });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.write('{"a":1}∆∆');
  input.write('∆{"b":2}∆');
  input.end('∆∆');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
});

await test('LiveMutexJSONParser preserves UTF-8 characters split across Buffer chunks', async () => {
  const payload = Buffer.from('{"msg":"hello 😊"}\n', 'utf8');
  const emoji = Buffer.from('😊', 'utf8');
  const split = payload.indexOf(emoji) + 1;

  assert.ok(split > 0);

  const chunks = [
    payload.subarray(0, split),
    payload.subarray(split)
  ];

  const out = await parseChunks(LiveMutexJSONParser, undefined, chunks);
  const baselineOut = await parseChunks(JSONParser, undefined, chunks);
  const expected = [{ msg: 'hello 😊' }];

  assert.deepEqual(out, expected);

  if (JSON.stringify(baselineOut) !== JSON.stringify(expected)) {
    process.stdout.write('comparison - JSONParser does not preserve this split UTF-8 payload; LiveMutexJSONParser does\n');
  }
});

await test('sliceStr removes syslog-like noise before JSON', async () => {
  const p = new JSONParser();
  const s = 'Oct  2 21:39:58 host ubuntu: ["opstop"]';
  const v = p.sliceStr(s);
  assert.equal(v, '["opstop"]');
});

await test('includeRawString annotates parsed objects with RawStringSymbol', async () => {
  const p = new JSONParser({ includeRawString: true });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}\n');
  const out = await outP;
  assert.equal(out.length, 1);
  assert.equal(out[0][RawStringSymbol], '{"a":1}');
});

await test('includeByteCount annotates parsed objects with RawJSONBytesSymbol', async () => {
  const p = new JSONParser({ includeByteCount: true });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}\n');
  const out = await outP;
  assert.equal(out.length, 1);
  assert.equal(out[0][RawJSONBytesSymbol], Buffer.byteLength('{"a":1}'));
});

await test('emitNonJSON emits "string" event when a line cannot be parsed', async () => {
  const p = new JSONParser({ emitNonJSON: true });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));

  const strings = [];
  p.on('string', s => strings.push(s));

  input.end('not-json\n{"ok":true}\n');
  const out = await outP;

  assert.deepEqual(out, [{ ok: true }]);
  assert.deepEqual(strings, ['not-json']);
});

await test('trackBytesRead counts bytes written into the parser', async () => {
  const p = new JSONParser({ trackBytesRead: true });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  const payload = Buffer.from('{"a":1}\n{"b":2}\n', 'utf8');
  input.end(payload);
  await outP;
  assert.equal(p.getBytesRead(), payload.length);
});

await test('trackBytesWritten counts bytes of successfully parsed JSON chunks', async () => {
  const p = new JSONParser({ trackBytesWritten: true });
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}\n{"b":2}\n');
  await outP;
  assert.equal(
    p.getBytesWritten(),
    Buffer.byteLength('{"a":1}') + Buffer.byteLength('{"b":2}')
  );
});

await test('delayEvery validates positive integers greater than 1', async () => {
  assert.throws(() => new JSONParser({ delayEvery: 1 }), /positive integer greater than 1/);
  assert.throws(() => new JSONParser({ delayEvery: 1.5 }), /positive integer greater than 1/);
  assert.throws(() => new JSONParser({ delayEvery: 0 }), /positive integer greater than 1/);
  assert.doesNotThrow(() => new JSONParser({ delayEvery: 2 }));
  assert.doesNotThrow(() => new LiveMutexJSONParser({ delayEvery: 2 }));
});

await test('createLiveMutexJSONParser applies a default per-record delayEvery', async () => {
  const p = createLiveMutexJSONParser();
  assert.equal(p.delay, true);
  assert.equal(p.delayEvery, defaultLiveMutexJSONParseDelayEvery);
});

await test('LiveMutexJSONParser yields during one large JSONL chunk', async () => {
  const baseline = new JSONParser({ delayEvery: 2 });
  const live = new LiveMutexJSONParser({ delayEvery: 2 });
  const baselineValues = [];
  const liveValues = [];
  const payload = Buffer.from(
    Array.from({ length: 6 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n',
    'utf8'
  );

  baseline.on('data', v => baselineValues.push(v));
  live.on('data', v => liveValues.push(v));

  let baselineDone = false;
  const baselineP = new Promise((resolve, reject) => {
    baseline._transform(payload, 'buffer', err => {
      if (err) {
        reject(err);
        return;
      }

      baselineDone = true;
      resolve();
    });
  });

  assert.equal(baselineValues.length, 6);
  assert.equal(baselineDone, true);
  await baselineP;
  assert.equal(baselineDone, true);

  let liveDone = false;
  const liveP = new Promise((resolve, reject) => {
    live._transform(payload, 'buffer', err => {
      if (err) {
        reject(err);
        return;
      }

      liveDone = true;
      resolve();
    });
  });

  assert.equal(liveValues.length, 2);
  assert.equal(liveDone, false);

  await liveP;
  assert.equal(liveDone, true);

  assert.deepEqual(
    liveValues,
    Array.from({ length: 6 }, (_, i) => ({ i }))
  );
});

await test('benchmarks JSONParser and LiveMutexJSONParser head-to-head', async () => {
  const count = 5000;
  const records = Array.from({ length: count }, (_, i) => ({
    i,
    ok: true,
    msg: `row-${i}`
  }));
  const payload = Buffer.from(records.map(v => JSON.stringify(v)).join('\n') + '\n', 'utf8');

  const baseline = await benchmarkParser(JSONParser, undefined, payload);
  const live = await benchmarkParser(LiveMutexJSONParser, undefined, payload);

  assert.equal(baseline.out.length, count);
  assert.equal(live.out.length, count);
  assert.deepEqual(live.out[0], baseline.out[0]);
  assert.deepEqual(live.out[count - 1], baseline.out[count - 1]);

  const baselineRate = Math.round(count / (baseline.ms / 1000));
  const liveRate = Math.round(count / (live.ms / 1000));
  process.stdout.write(
    `perf - JSONParser ${baseline.ms.toFixed(2)}ms (${baselineRate}/s), ` +
    `LiveMutexJSONParser ${live.ms.toFixed(2)}ms (${liveRate}/s)\n`
  );
});
