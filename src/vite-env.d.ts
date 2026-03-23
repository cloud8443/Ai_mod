/// <reference types="vite/client" />

import type {
  AIProvider,
  AIRequest,
  ConversionRequest,
  ParsedModMetadata,
  RuleTransformPlan,
  RuleTransformRequest,
  StoredSecret,
  CompatibilityReport
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
      startOpenAIDeviceFlow: (params: { clientId: string; openBrowser: boolean }) => Promise<{
        verificationUri: string;
        verificationUriComplete?: string;
        userCode: string;
        deviceCode: string;
        intervalSeconds: number;
        expiresInSeconds: number;
      }>;
      pollOpenAIDeviceFlow: (params: { clientId: string; deviceCode: string }) => Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
      }>;
    };
  }
}

export {};
