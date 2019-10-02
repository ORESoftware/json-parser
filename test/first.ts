#!/usr/bin/env node

import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as assert from 'assert';
import * as EE from 'events';
import * as strm from "stream";

import {JSONParser} from "../dist/main";

const j = new JSONParser();

const v = j.sliceStr('Oct  2 21:39:58 ip-172-31-9-171 ubuntu: ["opstop"]')


console.log(v);
