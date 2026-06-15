import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createSession } from '../server/src/lib/auth.js';

const envPath = join(process.cwd(), 'server/.env');
if (existsSync(envPath)) {
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

const ownerUserId = Number(process.argv[2] || 5);
const session = await createSession(ownerUserId);
console.log(JSON.stringify(session));
