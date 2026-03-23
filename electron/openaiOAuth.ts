import crypto from 'node:crypto';
import type { OAuthLinkStartResult, OAuthTokenResult } from '../src/lib/types/contracts.js';

const OPENAI_OAUTH_BASE = process.env.OPENAI_OAUTH_BASE?.trim() || 'https://auth.openai.com/oauth';
const DEFAULT_REDIRECT_URI = 'https://localhost/callback';
const TOKEN_TIMEOUT_MS = 20_000;

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

function assertClientId(raw: string | undefined): string {
  const clientId = raw?.trim() ?? '';
  if (!clientId) {
    throw new Error('Missing OpenAI OAuth client_id. Enter a valid client_id or use manual token input.');
  }
  return clientId;
}

function parseCode(raw: string, pending: PendingPkce): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Missing authorization code. Paste callback URL/code or use manual token input.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    const callbackState = url.searchParams.get('state');
    const code = url.searchParams.get('code') ?? '';

    if (!code) {
      throw new Error('Callback URL does not contain code. Paste callback URL/code or use manual token input.');
    }

    if (callbackState && callbackState !== pending.state) {
      throw new Error('OAuth state mismatch. Restart link login or use manual token input.');
    }

    return code;
  }

  if (trimmed.includes('?')) {
    const query = trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
    const params = new URLSearchParams(query);
    const code = params.get('code');
    const callbackState = params.get('state');
    if (code) {
      if (callbackState && callbackState !== pending.state) {
        throw new Error('OAuth state mismatch. Restart link login or use manual token input.');
      }
      return code;
    }
  }

  return trimmed;
}

export async function startOpenAILinkFlow(params: {
  clientId: string;
  redirectUri?: string;
  scope?: string;
}): Promise<OAuthLinkStartResult> {
  const clientId = assertClientId(params.clientId);
  const redirectUri = params.redirectUri?.trim() || DEFAULT_REDIRECT_URI;
  const scope = params.scope?.trim() || 'openid profile offline_access';
  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = createPkcePair();

  pendingByClient.set(clientId, {
    state,
    codeVerifier,
    redirectUri,
    createdAt: Date.now()
  });

  try {
    const authorizationUrl = `${OPENAI_OAUTH_BASE}/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
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
      codeChallengeMethod: 'S256',
      oauthBaseUrl: OPENAI_OAUTH_BASE
    };
  } catch (error) {
    pendingByClient.delete(clientId);
    throw error;
  }
}

export async function completeOpenAILinkFlow(params: {
  clientId: string;
  codeOrCallbackUrl: string;
}): Promise<OAuthTokenResult> {
  const clientId = assertClientId(params.clientId);
  const pending = pendingByClient.get(clientId);
  if (!pending) {
    throw new Error('No pending OAuth session found. Start link flow first or paste a manual token.');
  }

  const code = parseCode(params.codeOrCallbackUrl, pending);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${OPENAI_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.codeVerifier
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI token endpoint request timed out. Retry, or use manual token input.');
    }
    throw new Error(`OpenAI token endpoint request failed. Check network and retry, or use manual token input. (${error instanceof Error ? error.message : String(error)})`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI token exchange failed (${res.status}). ${msg || 'Please retry or use manual token input.'}`);
  }

  pendingByClient.delete(clientId);
  return (await res.json()) as OAuthTokenResult;
}
