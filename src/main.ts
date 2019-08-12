'use strict';

import * as stream from 'stream';
import * as assert from 'assert';

export const r2gSmokeTest = function () {
  // r2g command line app uses this exported function
  return true;
};

type EVCb<T = any> = (err?: any, v?: T) => void;

export interface JSONParserOpts {
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
  
  constructor(opts ?: JSONParserOpts) {
    super({objectMode: true, highWaterMark: 1});
    
    if (opts && opts.emitNonJSON) {
      this.emitNonJSON = true;
    }
    
    if (opts && opts.includeRawString) {
      this.isIncludeRawString = true;
    }
    
    if (opts && opts.delayEvery) {
      assert(opts.delayEvery && Number.isInteger(opts.delayEvery), 'the "delayEvery" option needs to be a postive integer');
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
  
  handleJSON(o: string) {
    
    let json = null;
    
    try {
      json = JSON.parse(o);
    } catch (err) {
      
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


