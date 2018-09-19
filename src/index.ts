'use strict';

import * as stream from 'stream';

export const r2gSmokeTest = function () {
  // r2g command line app uses this exported function
  return true;
};

type EVCb<T> = (err: any, T: any) => void;

export class JSONParser extends stream.Transform {

  lastLineData = '';

  constructor() {
    super({objectMode: true});
  }

  _transform(chunk: any, encoding: string, cb: Function) {

    let data = String(chunk);
    if (this.lastLineData) {
      data = this.lastLineData + data;
    }

    let lines = data.split('\n');
    this.lastLineData = lines.splice(lines.length - 1, 1)[0];

    for (let l of lines) {
      try {
        // l might be an empty string; ignore if so
        l && this.push(JSON.parse(l));
      }
      catch (err) {
        // noop
      }
    }

    cb();

  }

  _flush(cb: Function) {
    if (this.lastLineData) {
      try {
        this.push(JSON.parse(this.lastLineData));
      }
      catch (err) {
        // noop
      }
    }
    this.lastLineData = '';
    cb();
  }

}

export default JSONParser;


