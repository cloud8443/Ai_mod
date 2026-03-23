import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AICredentials } from '../src/lib/types/contracts.js';

type OpenClawConfig = {
  gateway?: {
    port?: number;
    auth?: {
      mode?: string;
      token?: string;
      password?: string;
    };
  };
};

export async function resolveOpenClawGatewayCredentials(input: AICredentials): Promise<AICredentials> {
  if (input.gatewayBaseUrl && input.gatewayToken) return input;

  const fromEnv = resolveFromEnv();
  if (fromEnv.gatewayBaseUrl && fromEnv.gatewayToken) {
    return {
      ...input,
      gatewayBaseUrl: input.gatewayBaseUrl || fromEnv.gatewayBaseUrl,
      gatewayToken: input.gatewayToken || fromEnv.gatewayToken,
      gatewayAgentId: input.gatewayAgentId || fromEnv.gatewayAgentId,
      gatewayModel: input.gatewayModel || fromEnv.gatewayModel
    };
  }

  const fromConfig = await resolveFromOpenClawConfig();
  return {
    ...input,
    gatewayBaseUrl: input.gatewayBaseUrl || fromConfig.gatewayBaseUrl,
    gatewayToken: input.gatewayToken || fromConfig.gatewayToken,
    gatewayAgentId: input.gatewayAgentId || fromConfig.gatewayAgentId,
    gatewayModel: input.gatewayModel || fromConfig.gatewayModel
  };
}

function resolveFromEnv(): AICredentials {
  const baseUrl = process.env.OPENCLAW_GATEWAY_HTTP_URL
    || process.env.OPENCLAW_GATEWAY_URL
    || process.env.OPENCLAW_BASE_URL
    || '';

  const token = process.env.OPENCLAW_GATEWAY_TOKEN
    || process.env.OPENCLAW_GATEWAY_PASSWORD
    || '';

  return {
    gatewayBaseUrl: baseUrl,
    gatewayToken: token,
    gatewayAgentId: process.env.OPENCLAW_GATEWAY_AGENT_ID || 'main',
    gatewayModel: process.env.OPENCLAW_GATEWAY_MODEL || 'openclaw'
  };
}

async function resolveFromOpenClawConfig(): Promise<AICredentials> {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as OpenClawConfig;
    const port = parsed.gateway?.port || 18789;
    const mode = parsed.gateway?.auth?.mode;
    const token = mode === 'password' ? parsed.gateway?.auth?.password : parsed.gateway?.auth?.token;

    return {
      gatewayBaseUrl: `http://127.0.0.1:${port}`,
      gatewayToken: token || '',
      gatewayAgentId: 'main',
      gatewayModel: 'openclaw'
    };
  } catch {
    return {};
  }
}
