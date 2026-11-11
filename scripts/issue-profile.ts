// Issue a verified profile by hand, after you have checked the buyer yourself.
//
//   npm run issue -- --id buyer:acme --name "Acme Holdings" --funds 500000 \
//     --agent agent:acme-1 --may sign_nda:standard-v1,blind_match,book_call --days 30
//
// Signing a profile is a statement that you verified this person's identity and
// that they can show at least this much in funds. Do not run this until you have.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { issueProfile } from '../lib/profile.ts';

const args: Record<string, string | undefined> = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];

const keyFile = args.key || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.local', 'issuer-private.pem');
if (!args.id || !args.name || !args.agent || !fs.existsSync(keyFile)) {
  console.error('Usage: npm run issue -- --id <principal id> --name <name> --agent <agent id> [--funds <usd>] [--may a,b,c] [--kind company|person] [--days 30] [--issuer dutch-door-verify] [--key path]');
  if (!fs.existsSync(keyFile)) console.error('No issuer key at ' + keyFile + '. Run "npm run keys" first.');
  process.exit(1);
}
const funds = args.funds != null ? Number(args.funds) : undefined;
if (funds !== undefined && !(Number.isFinite(funds) && funds >= 0)) {
  console.error('--funds must be a number of dollars.');
  process.exit(1);
}

console.log(
  issueProfile({
    issuer: args.issuer || 'dutch-door-verify',
    privateKey: fs.readFileSync(keyFile, 'utf8'),
    principal: { id: args.id, name: args.name, kind: args.kind || 'company' },
    verified: { identity: true, ...(funds !== undefined ? { funds_usd_at_least: funds } : {}) },
    agent: { id: args.agent, may: (args.may || '').split(',').map((s) => s.trim()).filter(Boolean) },
    ttlMs: Number(args.days || 30) * 86400000,
  }),
);
