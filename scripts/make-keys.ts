// Run with: npm run keys
// Makes the secrets a deployment needs and writes them to .local/ (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateIssuerKeys } from '../lib/profile.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.local');
fs.mkdirSync(dir, { recursive: true });
const key = (): string => randomBytes(24).toString('hex');
const issuer = generateIssuerKeys();
const envFile = path.join(dir, 'env');
if (fs.existsSync(envFile)) {
  console.error('.local/env already exists. Delete it first if you really want new keys.');
  process.exit(1);
}
fs.writeFileSync(path.join(dir, 'issuer-private.pem'), issuer.privateKey, { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'trusted-issuers.json'), JSON.stringify({ 'dutch-door-verify': issuer.publicKey }, null, 2));
fs.writeFileSync(
  envFile,
  ['ARBITER_CREATOR_KEYS=' + key(), 'OWNER_KEYS=example-broker=' + key(), 'TRUSTED_ISSUERS_FILE=' + path.join(dir, 'trusted-issuers.json'), ''].join('\n'),
  { mode: 0o600 },
);
console.log('Wrote .local/env, .local/trusted-issuers.json and .local/issuer-private.pem.');
console.log('Keep issuer-private.pem secret: it signs verified profiles.');
