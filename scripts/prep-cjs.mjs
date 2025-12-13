import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = new URL('../dist/cjs/', import.meta.url);
await mkdir(dir, { recursive: true });

// Ensure Node treats dist/cjs/*.js as CommonJS even though the package root is "type": "module".
await writeFile(join(dir.pathname, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');


