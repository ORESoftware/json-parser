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
  delimiter?: string,
  trackBytesWritten?: boolean,
  trackBytesRead?: boolean,
  includeByteCount?: boolean
}

export const RawJSONBytesSymbol = Symbol('raw.json.bytes');
export const JSONBytesSymbol = Symbol('json.bytes');

export class JSONParser extends stream.Transform {
  
  lastLineData = '';
  debug = false;
  delimiter = '\n';
  jpBytesWritten = 0;
  jpBytesRead = 0;
  isTrackBytesRead = false;
  isTrackBytesWritten = false;
  isIncludeByteCount = false;
  
  constructor(opts ?: JSONParserOpts) {
    super({objectMode: true});
    
    if (opts && opts.includeByteCount) {
      this.isIncludeByteCount = true;
    }
    
    if (opts && opts.trackBytesWritten) {
      this.isTrackBytesWritten = true;
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
  
  _transform(chunk: any, encoding: string, cb: Function) {
    
    let data = String(chunk);
    
    if (this.isTrackBytesRead) {
      this.jpBytesRead += Buffer.from(data).length;
    }
    
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
      const trimmed = String(l).trim();
      
      try {
        // trimmed might be an empty string; ignore if so
        trimmed && (json = JSON.parse(trimmed));
      }
      catch (err) {
        if (this.debug) {
          console.error('json-parser:', 'error parsing line:', l);
          console.error('json-parser:', err.message);
        }
        continue;
        // noop
      }
      
      if (json) {
        if (this.isTrackBytesWritten) {
          this.jpBytesWritten += Buffer.from(l).length
        }
        if(this.isIncludeByteCount){
          json[RawJSONBytesSymbol] = Buffer.from(l).length;
          json[JSONBytesSymbol] = Buffer.from(trimmed).length;
        }
        this.push(json);
      }
      
    }
    
    cb();
    
  }
  
  _flush(cb: Function) {
    if (this.lastLineData) {
      
      const lld = this.lastLineData;
      const  l = String(lld).trim();
      
      let json = null;
      
      try {
        json = JSON.parse(l);
      }
      catch (err) {
        if (this.debug) {
          console.error('json-parser:', 'error parsing line:', l);
          console.error('json-parser:', err.message);
        }
      }
      
      if(json){
        if (this.isTrackBytesWritten) {
          this.jpBytesWritten += Buffer.from(l).length
        }
        if(this.isIncludeByteCount){
          json[RawJSONBytesSymbol] = Buffer.from(lld).length;
          json[JSONBytesSymbol] = Buffer.from(l).length;
        }
        this.push(json);
      }
      
    }
    this.lastLineData = '';
    cb();
  }
  
}

export default JSONParser;


