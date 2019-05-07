'use strict';

import * as stream from 'stream';
import * as assert from 'assert';

export const r2gSmokeTest = function () {
  // r2g command line app uses this exported function
  return true;
};

type EVCb<T> = (err: any, T: any) => void;

export interface JSONParserOpts {
  debug?: boolean,
  delimiter?: string
}

export class JSONParser extends stream.Transform {

  lastLineData = '';
  debug = false;
  delimiter = '\n';

  constructor(opts ?: JSONParserOpts) {
    super({objectMode: true});

    if (opts && 'debug' in opts) {
      assert.strictEqual(typeof opts.debug, 'boolean', '"debug" option should be a boolean value.');
      this.debug = opts.debug;
    }

    if (opts && 'delimiter' in opts) {
      assert(opts.delimiter && typeof opts.delimiter === 'string', '"delimiter" option should be a string value.');
      this.delimiter = opts.delimiter;
    }
  }

  _transform(chunk: any, encoding: string, cb: Function) {

    let data = String(chunk);
    if (this.lastLineData) {
      data = this.lastLineData + data;
    }

    const lines = data.split(this.delimiter);
    this.lastLineData = lines.pop();

    for (let l of lines) {

      if (!l) {
        continue;
      }

      let json = null;

      try {
        l = String(l).trim();
        // l might be an empty string; ignore if so
        l && (json = JSON.parse(String(l).trim()));
      } catch (err) {
        if (this.debug) {
          console.error('json-parser:', 'error parsing line:', l);
          console.error('json-parser:', err.message);
        }
        continue;
        // noop
      }

      json && this.push(json);
    }

    cb();

  }

  _flush(cb: Function) {
    if (this.lastLineData) {

      let json = null, l = String(this.lastLineData).trim();

      try {
        json = JSON.parse(l);
      } catch (err) {
        if (this.debug) {
          console.error('json-parser:', 'error parsing line:', l);
          console.error('json-parser:', err.message);
        }
      }

      json && this.push(json);

    }
    this.lastLineData = '';
    cb();
  }

}

export default JSONParser;


