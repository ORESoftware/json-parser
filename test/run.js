#!/usr/bin/env node
'use strict';

import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';

import {
  JSONParser,
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

await test('parses newline-delimited JSON objects', async () => {
  const p = new JSONParser();
  const input = new PassThrough();
  const outP = collectStream(input.pipe(p));
  input.end('{"a":1}\n{"b":2}\n');
  const out = await outP;
  assert.deepEqual(out, [{ a: 1 }, { b: 2 }]);
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


