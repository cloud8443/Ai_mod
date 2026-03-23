import type { AICredentials, AIProvider } from '../types/contracts';

interface ProviderClient {
  generatePlan(prompt: string): Promise<string>;
}

export function createProviderClient(provider: AIProvider, credentials: AICredentials): ProviderClient {
  switch (provider) {
    case 'openai':
      return openAIClient(credentials);
    case 'anthropic':
      return anthropicClient(credentials);
    case 'gemini':
      return geminiClient(credentials);
    case 'openclaw-gateway':
      return openclawGatewayClient(credentials);
    default:
      throw new Error(`Unsupported provider: ${String(provider)}`);
  }
}

function resolveBearer(credentials: AICredentials): string {
  return credentials.oauthAccessToken ?? credentials.apiKey ?? '';
}

function openAIClient(credentials: AICredentials): ProviderClient {
  return {
    async generatePlan(prompt: string) {
      const token = resolveBearer(credentials);
      if (!token) return '[OpenAI] Missing credentials. Provide API key or OAuth access token.';

      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          input: prompt
        })
      });

      if (!res.ok) return `[OpenAI] Request failed (${res.status}).`;
      const json = (await res.json()) as { output_text?: string };
      return json.output_text ?? '[OpenAI] No text output.';
    }
  };
}

function anthropicClient(credentials: AICredentials): ProviderClient {
  return {
    async generatePlan(prompt: string) {
      const token = credentials.apiKey;
      if (!token) return '[Anthropic] Missing API key.';

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': token,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) return `[Anthropic] Request failed (${res.status}).`;
      const json = (await res.json()) as { content?: Array<{ text?: string }> };
      return json.content?.[0]?.text ?? '[Anthropic] No text output.';
    }
  };
}

function geminiClient(credentials: AICredentials): ProviderClient {
  return {
    async generatePlan(prompt: string) {
      const token = credentials.apiKey;
      if (!token) return '[Gemini] Missing API key.';

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!res.ok) return `[Gemini] Request failed (${res.status}).`;
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[Gemini] No text output.';
    }
  };
}

function openclawGatewayClient(credentials: AICredentials): ProviderClient {
  return {
    async generatePlan(prompt: string) {
      const baseUrl = normalizeBaseUrl(credentials.gatewayBaseUrl);
      const token = credentials.gatewayToken ?? credentials.apiKey ?? credentials.oauthAccessToken;
      if (!baseUrl || !token) {
        throw new Error('OPENCLAW_GATEWAY_UNAVAILABLE:missing-config');
      }

      const agentId = credentials.gatewayAgentId || 'main';
      const model = credentials.gatewayModel || 'openclaw';

      const responseResult = await tryResponsesEndpoint({ baseUrl, token, prompt, agentId, model });
      if (responseResult) return responseResult;

      const chatResult = await tryChatCompletionsEndpoint({ baseUrl, token, prompt, agentId, model });
      if (chatResult) return chatResult;

      throw new Error('OPENCLAW_GATEWAY_UNAVAILABLE:endpoint-disabled');
    }
  };
}

function normalizeBaseUrl(base?: string): string {
  if (!base) return '';
  return base.replace(/\/+$/, '');
}

async function tryResponsesEndpoint(params: {
  baseUrl: string;
  token: string;
  prompt: string;
  agentId: string;
  model: string;
}): Promise<string | null> {
  try {
    const res = await fetch(`${params.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
        'x-openclaw-agent-id': params.agentId
      },
      body: JSON.stringify({ model: params.model, input: params.prompt })
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 405) return null;
      if (res.status === 401 || res.status === 403) throw new Error('OPENCLAW_GATEWAY_UNAVAILABLE:unauthorized');
      if (res.status >= 500) throw new Error('OPENCLAW_GATEWAY_UNAVAILABLE:server-error');
      return null;
    }

    const json = (await res.json()) as {
      output_text?: string;
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };

    if (json.output_text?.trim()) return json.output_text;
    const textPart = json.output?.flatMap((item) => item.content ?? []).find((part) => part.type === 'output_text' && part.text)?.text;
    return textPart?.trim() ? textPart : '[OpenClaw Gateway] No text output.';
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('OPENCLAW_GATEWAY_UNAVAILABLE:')) throw error;
    return null;
  }
}

async function tryChatCompletionsEndpoint(params: {
  baseUrl: string;
  token: string;
  prompt: string;
  agentId: string;
  model: string;
}): Promise<string | null> {
  try {
    const res = await fetch(`${params.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
        'x-openclaw-agent-id': params.agentId
      },
      body: JSON.stringify({
        model: params.model,
        messages: [{ role: 'user', content: params.prompt }]
      })
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 405) return null;
      if (res.status === 401 || res.status === 403) throw new Error('OPENCLAW_GATEWAY_UNAVAILABLE:unauthorized');
      if (res.status >= 500) throw new Error('OPENCLAW_GATEWAY_UNAVAILABLE:server-error');
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content;
    return text?.trim() ? text : '[OpenClaw Gateway] No text output.';
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('OPENCLAW_GATEWAY_UNAVAILABLE:')) throw error;
    return null;
  }
}
