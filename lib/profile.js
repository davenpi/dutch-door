// Portable verified profile: a signed statement about who a visitor is, what
// has been verified about them, and what their agent may commit to.
//
// Format: base64url(JSON payload) + "." + base64url(Ed25519 signature).
// The issuer is whoever did the verifying. Checking identity and funds in the
// real world is outside this file; this is only the envelope.
import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from 'node:crypto';

export class ProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function generateIssuerKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

/**
 * @param {object} p
 * @param {string} p.issuer            Issuer id, for example "dutch-door-verify".
 * @param {string} p.privateKey        Issuer private key, PEM.
 * @param {{id:string,name:string,kind:string}} p.principal  The person or company the agent acts for.
 * @param {{identity:boolean,funds_usd_at_least?:number}} p.verified  What the issuer checked.
 * @param {{id:string,may:string[]}} p.agent  The agent and what it may commit to.
 * @param {number} [p.ttlMs]           Lifetime, default 30 days.
 * @param {number} [p.now]
 */
export function issueProfile({ issuer, privateKey, principal, verified, agent, ttlMs = 30 * 86400000, now = Date.now() }) {
  if (!issuer || !principal?.id || !agent?.id) throw new ProfileError('bad_profile', 'issuer, principal.id and agent.id are required.');
  const payload = {
    v: 1,
    iss: issuer,
    iat: now,
    exp: now + ttlMs,
    principal,
    verified: { identity: Boolean(verified?.identity), ...(verified?.funds_usd_at_least != null ? { funds_usd_at_least: verified.funds_usd_at_least } : {}) },
    agent: { id: agent.id, may: [...(agent.may || [])] },
  };
  const body = Buffer.from(JSON.stringify(payload));
  const signature = sign(null, body, createPrivateKey(privateKey));
  return b64(body) + '.' + b64(signature);
}

/**
 * @param {string} token
 * @param {Record<string,string>} trustedIssuers  issuer id -> public key PEM
 * @returns the payload, if the signature is valid, the issuer is trusted and it has not expired.
 */
export function verifyProfile(token, trustedIssuers, now = Date.now()) {
  if (typeof token !== 'string' || !token.includes('.')) throw new ProfileError('malformed', 'Profile is not in the expected format.');
  const [bodyPart, sigPart] = token.split('.');
  let payload;
  let body;
  try {
    body = Buffer.from(bodyPart, 'base64url');
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    throw new ProfileError('malformed', 'Profile is not in the expected format.');
  }
  const key = trustedIssuers?.[payload?.iss];
  if (!key) throw new ProfileError('untrusted_issuer', 'This front door does not accept profiles from that issuer.');
  let ok = false;
  try {
    ok = verify(null, body, createPublicKey(key), Buffer.from(sigPart, 'base64url'));
  } catch {
    ok = false;
  }
  if (!ok) throw new ProfileError('bad_signature', 'Profile signature does not check out.');
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new ProfileError('expired', 'Profile has expired.');
  return payload;
}
