// Portable verified profile: a signed statement about who a visitor is, what
// has been verified about them, and what their agent may commit to.
//
// Format: base64url(JSON payload) + "." + base64url(Ed25519 signature).
// The issuer is whoever did the verifying. Checking identity and funds in the
// real world is outside this file; this is only the envelope.
import { generateKeyPairSync, sign, verify, createPublicKey, createPrivateKey } from 'node:crypto';
import { isRecord } from './unchecked.ts';

export type ProfileErrorCode = 'bad_profile' | 'malformed' | 'untrusted_issuer' | 'bad_signature' | 'expired';

export class ProfileError extends Error {
  code: ProfileErrorCode;

  constructor(code: ProfileErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** The person or company an agent acts for. */
export interface Principal {
  id: string;
  name: string;
  /** For example "company" or "person". */
  kind: string;
}

/** What the issuer checked. */
export interface Verified {
  identity: boolean;
  funds_usd_at_least?: number;
}

/** The agent and what it may commit to, for example "sign_nda:standard-v1", "blind_match", "book_call". */
export interface AgentAuthority {
  id: string;
  may: string[];
}

/** What is signed inside a profile token. */
export interface ProfilePayload {
  v: 1;
  /** Issuer id. */
  iss: string;
  /** Issued at, in milliseconds. */
  iat: number;
  /** Expires at, in milliseconds. */
  exp: number;
  principal: Principal;
  verified: Verified;
  agent: AgentAuthority;
}

export interface IssuerKeys {
  /** PEM. */
  publicKey: string;
  /** PEM. Keep it secret: it signs verified profiles. */
  privateKey: string;
}

/** Issuer id -> public key PEM. */
export type TrustedIssuers = Record<string, string>;

export interface IssueProfileInput {
  /** Issuer id, for example "dutch-door-verify". */
  issuer: string;
  /** Issuer private key, PEM. */
  privateKey: string;
  principal: Principal;
  verified: Verified;
  agent: AgentAuthority;
  /** Lifetime, default 30 days. */
  ttlMs?: number;
  now?: number;
}

const b64 = (buf: Uint8Array): string => Buffer.from(buf).toString('base64url');

export function generateIssuerKeys(): IssuerKeys {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  // A PEM export is always text.
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

/** Sign a profile. Returns the token. */
export function issueProfile({ issuer, privateKey, principal, verified, agent, ttlMs = 30 * 86400000, now = Date.now() }: IssueProfileInput): string {
  if (!issuer || !principal?.id || !agent?.id) throw new ProfileError('bad_profile', 'issuer, principal.id and agent.id are required.');
  const payload: ProfilePayload = {
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
 * Check a profile token. The token is untrusted until the signature checks out.
 * @returns the payload, if the signature is valid, the issuer is trusted and it has not expired.
 */
export function verifyProfile(token: unknown, trustedIssuers: TrustedIssuers, now = Date.now()): ProfilePayload {
  if (typeof token !== 'string' || !token.includes('.')) throw new ProfileError('malformed', 'Profile is not in the expected format.');
  const [bodyPart, sigPart] = token.split('.');
  let payload: unknown;
  let body: Buffer;
  try {
    body = Buffer.from(bodyPart, 'base64url');
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    throw new ProfileError('malformed', 'Profile is not in the expected format.');
  }
  const key = isRecord(payload) && typeof payload.iss === 'string' ? trustedIssuers?.[payload.iss] : undefined;
  if (!isRecord(payload) || !key) throw new ProfileError('untrusted_issuer', 'This front door does not accept profiles from that issuer.');
  let ok = false;
  try {
    ok = verify(null, body, createPublicKey(key), Buffer.from(sigPart, 'base64url'));
  } catch {
    ok = false;
  }
  if (!ok) throw new ProfileError('bad_signature', 'Profile signature does not check out.');
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new ProfileError('expired', 'Profile has expired.');
  // Signed by an issuer this door trusts, so the rest of the shape is the issuer's word.
  return payload as unknown as ProfilePayload;
}
