/// <reference types="vite/client" />

import type {
  AIProvider,
  AIRequest,
  ConversionRequest,
  ParsedModMetadata,
  RuleTransformPlan,
  RuleTransformRequest,
  StoredSecret,
  CompatibilityReport,
  OAuthLinkStartResult,
  OAuthTokenResult
} from './lib/types/contracts';

declare global {
  interface Window {
    mcModConverter: {
      parseMetadata: (files: { name: string; content: string }[]) => Promise<ParsedModMetadata[]>;
      analyzeCompatibility: (request: ConversionRequest) => Promise<CompatibilityReport>;
      buildPrompt: (request: ConversionRequest) => Promise<string>;
      generatePlan: (request: AIRequest) => Promise<string>;
      transformStub: (request: ConversionRequest) => Promise<unknown>;
      runRulesTransform: (request: RuleTransformRequest) => Promise<RuleTransformPlan>;
      setSecret: (provider: AIProvider, value: string) => Promise<StoredSecret>;
      getSecret: (provider: AIProvider) => Promise<StoredSecret | null>;
      clearSecret: (provider: AIProvider) => Promise<{ ok: boolean }>;
      startOpenAILinkFlow: (params: { clientId: string; redirectUri?: string; openBrowser: boolean }) => Promise<OAuthLinkStartResult>;
      completeOpenAILinkFlow: (params: { clientId: string; codeOrCallbackUrl: string }) => Promise<OAuthTokenResult>;
    };
  }
}

export {};
