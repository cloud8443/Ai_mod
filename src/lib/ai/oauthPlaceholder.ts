import type { AICredentials } from '../types/contracts';

/**
 * Placeholder for future OAuth/OIDC provider integration.
 * Current MVP supports pre-issued OAuth access tokens only.
 */
export class OAuthTokenManager {
  constructor(private readonly credentials: AICredentials) {}

  getAccessToken(): string | undefined {
    return this.credentials.oauthAccessToken;
  }

  async beginOAuthFlow(): Promise<{ status: 'not-implemented'; message: string }> {
    return {
      status: 'not-implemented',
      message: 'OAuth browser/device-code flow is not implemented in MVP. Paste an access token manually.'
    };
  }
}
