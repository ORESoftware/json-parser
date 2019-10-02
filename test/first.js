#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("../dist/main");
const j = new main_1.JSONParser();
const v = j.sliceStr('Oct  2 21:39:58 ip-172-31-9-171 ubuntu: ["opstop"]');
console.log(v);
