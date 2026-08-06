#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const fs = require('fs');
const EE = require('events');

process.on('unhandledRejection', (reason, p) => {
  // note: unless we force process to exit with 1, process may exit with 0 upon an unhandledRejection
  console.error(reason);
  process.exit(1);
});

const {JSONParser} = require('@oresoftware/json-stream-parser');

console.log('Running test', __filename);

const k = cp.spawn('bash');
const foo = 'medicine';

k.stdin.end(`

  foo="${foo}"
  cat <<EOF\n{"foo":"$foo"}\nEOF

`);

const to = setTimeout(() => {
  console.error('did not receive parsed JSON object within alloted time.');
  process.exit(1);
}, 300);

k.stdout.pipe(new JSONParser()).on('data', d => {
  
  clearTimeout(to);
  try {
    assert.deepStrictEqual(d, {foo: foo});
    process.exit(0);
  }
  catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  
});

