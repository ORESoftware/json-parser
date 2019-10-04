'use strict';

import * as stream from 'stream';
import * as assert from 'assert';

export const r2gSmokeTest = function () {
  // r2g command line app uses this exported function
  return true;
};

type EVCb<T = any> = (err?: any, v?: T) => void;

export interface JSONParserOpts {
  wrapMetadata?: boolean,
  debug?: boolean,
  delimiter?: string,
  trackBytesWritten?: boolean,
  trackBytesRead?: boolean,
  includeByteCount?: boolean,
  emitNonJSON?: boolean,
  includeRawString?: boolean,
  stringifyNonJSON?: boolean,
  delayEvery?: number
}

export const RawStringSymbol = Symbol('raw.json.str');
export const RawJSONBytesSymbol = Symbol('raw.json.bytes');
export const JSONBytesSymbol = Symbol('json.bytes');

export class JSONParser<T = any> extends stream.Transform {
  
  emitNonJSON = false;
  lastLineData = '';
  debug = false;
  delimiter = '\n';
  cleanFront = true;
  jpBytesWritten = 0;
  stringifyNonJSON = false;
  jpBytesRead = 0;
  isTrackBytesRead = false;
  isTrackBytesWritten = false;
  isIncludeRawString = false;
  isIncludeByteCount = false;
  delayEvery = -1;
  delay = false;
  count = 1;
  wrapMetadata = false;
  
  constructor(opts ?: JSONParserOpts) {
    super({objectMode: true, highWaterMark: 1});
    
    if (opts && opts.emitNonJSON) {
      this.emitNonJSON = true;
    }
    
    if (opts && ('wrapMetadata' in opts)) {
      this.wrapMetadata = Boolean(opts.wrapMetadata);
    }
    
    if (opts && opts.includeRawString) {
      this.isIncludeRawString = true;
    }
    
    if (opts && ('delayEvery' in opts)) {
      assert(opts.delayEvery > 1 && Number.isInteger(opts.delayEvery),
        'the "delayEvery" option needs to be a positive integer greater than 1');
      this.delay = true;
      this.delayEvery = opts.delayEvery;
    }
    
    if (opts && opts.includeByteCount) {
      this.isIncludeByteCount = true;
    }
    
    if (opts && opts.trackBytesWritten) {
      this.isTrackBytesWritten = true;
    }
    
    if (opts && opts.stringifyNonJSON) {
      this.stringifyNonJSON = true;
    }
    
    if (opts && opts.trackBytesRead) {
      this.isTrackBytesRead = true;
    }
    
    if (opts && 'debug' in opts) {
      assert.strictEqual(typeof opts.debug, 'boolean', '"debug" option should be a boolean value.');
      this.debug = opts.debug;
    }
    
    if (opts && 'delimiter' in opts) {
      assert(opts.delimiter && typeof opts.delimiter === 'string', '"delimiter" option should be a string value.');
      this.delimiter = opts.delimiter;
    }
  }
  
  getBytesRead() {
    return this.jpBytesRead;
  }
  
  getBytesWritten() {
    return this.jpBytesWritten;
  }
  
  sliceStr(o: string) {
    
    const z = o.indexOf('∆˚ø');
    
    if (z >= 0) {
      return o.slice(z);
    }
    
    const i = [
      o.indexOf('["'),
      o.indexOf('{"'),
      o.indexOf('[['),
      o.indexOf('[[[')
    ].reduce((a, b) => b > 0 && b < a ? b : a, 0);
    
    // console.log('sliced json-stream string:', o);
    
    if (i <= 0) {
      return o;
    }
    
    return o.slice(i);
  }
  
  handleJSON(o: string) {
    
    // console.log('raw json-stream string:', o);
    
    if (this.cleanFront) {
      // sometimes there is some noise in the beginning of a line before the JSON starts
      // for example with syslog, or with raw docker-compose logs, etc
      if (!((o[0] === '[' || o[0] === '{') && o[1] === '"')) {
        o = this.sliceStr(o);
      }
    }
    
    let json = null;
    
    try {
      json = JSON.parse(o);
    }
    catch (err) {
      
      if (this.debug) {
        console.error('json-parser:', 'error parsing line:', o.trim());
        console.error('json-parser:', err.message);
      }
      
      if (this.emitNonJSON) {
        this.emit('string', o);
      }
      
      if (this.stringifyNonJSON) {
        this.emit('data', JSON.stringify(o));
      }
      
      return;
    }
    
    if (this.isIncludeByteCount && json && typeof json === 'object') {
      json[RawJSONBytesSymbol] = Buffer.byteLength(o);
    }
    
    if (this.isIncludeRawString && json && typeof json === 'object') {
      json[RawStringSymbol] = o;
    }
    
    this.push(json);
    
    if (this.isTrackBytesWritten) {
      this.jpBytesWritten += Buffer.byteLength(o);
    }
    
  }
  
  _transform(chunk: any, encoding: string, cb: EVCb<void>) {
    
    if (this.isTrackBytesRead) {
      this.jpBytesRead += chunk.length;
    }
    
    let data = String(chunk || '');
    
    if (this.lastLineData) {
      data = this.lastLineData + data;
    }
    
    const lines = data.split(this.delimiter);
    this.lastLineData = lines.pop();
    
    for (let l of lines) {
      
      if (!l) {
        continue;
      }
      
      this.handleJSON(l);
      
    }
    
    if (this.delay) {
      if ((this.count++ % this.delayEvery) === 0) {
        this.count = 1;
        setImmediate(cb, null);
        return;
      }
    }
    
    cb();
    
  }
  
  _flush(cb: Function) {
    
    if (this.lastLineData) {
      this.handleJSON(this.lastLineData);
      this.lastLineData = '';
    }
    
    cb();
  }
  
}

export default JSONParser;


