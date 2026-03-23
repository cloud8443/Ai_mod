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
