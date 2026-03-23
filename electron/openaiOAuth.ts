import type { OAuthDeviceStartResult } from '../src/lib/types/contracts.js';

const OPENAI_OAUTH_BASE = 'https://auth.openai.com/oauth';

interface DeviceCodeRaw {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface TokenRaw {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

export async function startOpenAIDeviceFlow(clientId: string, scope = 'openid profile offline_access'): Promise<OAuthDeviceStartResult> {
  const res = await fetch(`${OPENAI_OAUTH_BASE}/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to start OpenAI device flow (${res.status})`);
  }

  const json = (await res.json()) as DeviceCodeRaw;
  return {
    verificationUri: json.verification_uri,
    verificationUriComplete: json.verification_uri_complete,
    userCode: json.user_code,
    deviceCode: json.device_code,
    intervalSeconds: json.interval ?? 5,
    expiresInSeconds: json.expires_in
  };
}

export async function pollOpenAIDeviceToken(params: {
  clientId: string;
  deviceCode: string;
}): Promise<TokenRaw> {
  const res = await fetch(`${OPENAI_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: params.clientId,
      device_code: params.deviceCode
    })
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI token poll failed (${res.status}): ${msg}`);
  }

  return (await res.json()) as TokenRaw;
}
