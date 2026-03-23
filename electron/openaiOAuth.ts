import crypto from 'node:crypto';
import type { OAuthLinkStartResult, OAuthTokenResult } from '../src/lib/types/contracts.js';

const OPENAI_OAUTH_BASE = 'https://auth.openai.com/oauth';
const DEFAULT_REDIRECT_URI = 'https://localhost/callback';

type PendingPkce = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
};

const pendingByClient = new Map<string, PendingPkce>();

function base64url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge: challenge };
}

export async function startOpenAILinkFlow(params: {
  clientId: string;
  redirectUri?: string;
  scope?: string;
}): Promise<OAuthLinkStartResult> {
  const redirectUri = params.redirectUri?.trim() || DEFAULT_REDIRECT_URI;
  const scope = params.scope?.trim() || 'openid profile offline_access';
  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = createPkcePair();

  pendingByClient.set(params.clientId, {
    state,
    codeVerifier,
    redirectUri,
    createdAt: Date.now()
  });

  const authorizationUrl = `${OPENAI_OAUTH_BASE}/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state
  }).toString()}`;

  return {
    authorizationUrl,
    state,
    redirectUri,
    codeChallengeMethod: 'S256'
  };
}

export async function completeOpenAILinkFlow(params: {
  clientId: string;
  codeOrCallbackUrl: string;
}): Promise<OAuthTokenResult> {
  const pending = pendingByClient.get(params.clientId);
  if (!pending) {
    throw new Error('No pending OAuth session found. Start link flow first.');
  }

  const trimmed = params.codeOrCallbackUrl.trim();
  const looksLikeUrl = /^https?:\/\//i.test(trimmed);
  let code = trimmed;

  if (looksLikeUrl) {
    const url = new URL(trimmed);
    const callbackState = url.searchParams.get('state');
    code = url.searchParams.get('code') ?? '';

    if (!code) {
      throw new Error('Callback URL does not contain a code parameter.');
    }

    if (callbackState && callbackState !== pending.state) {
      throw new Error('OAuth state mismatch. Restart login and try again.');
    }
  }

  if (!code) {
    throw new Error('Missing authorization code. Paste callback URL or code.');
  }

  const res = await fetch(`${OPENAI_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: params.clientId,
      code,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.codeVerifier
    })
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI token exchange failed (${res.status}): ${msg}`);
  }

  pendingByClient.delete(params.clientId);
  return (await res.json()) as OAuthTokenResult;
}
