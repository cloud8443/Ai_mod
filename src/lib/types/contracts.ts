export type ModLoader = 'forge' | 'fabric' | 'unknown';

export interface ParsedModMetadata {
  loader: ModLoader;
  modId: string;
  modName?: string;
  version?: string;
  minecraftVersions: string[];
  dependencies: Array<{ id: string; versionRange?: string; required: boolean }>;
  sourceFile: string;
}

export interface ConversionRequest {
  source: ParsedModMetadata[];
  target: {
    minecraftVersion: string;
    loader: Exclude<ModLoader, 'unknown'>;
  };
  userGoals?: string;
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AICredentials {
  apiKey?: string;
  oauthAccessToken?: string;
}

export interface AIRequest {
  provider: AIProvider;
  credentials: AICredentials;
  prompt: string;
}

export interface CompatibilityIssue {
  severity: 'info' | 'warn' | 'error';
  code: string;
  message: string;
  modId?: string;
}

export interface CompatibilityFactor {
  label: string;
  impact: number;
  detail: string;
}

export interface CompatibilityReport {
  score: number;
  confidence: number;
  summary: string;
  issues: CompatibilityIssue[];
  matchedKnowledgeEntryIds: string[];
  confidenceFactors: CompatibilityFactor[];
}

export interface SafeTransformResult {
  status: 'planned' | 'blocked';
  actions: string[];
  warnings: string[];
}

export interface SourceFileInput {
  path: string;
  content: string;
}

export interface RuleTransformRequest {
  files: SourceFileInput[];
  sourceLoader: 'forge' | 'fabric';
  targetLoader: 'forge' | 'fabric';
  sourceMinecraftVersion?: string;
  targetMinecraftVersion: string;
  mode: 'preview' | 'apply';
  backup: {
    enabled: boolean;
    strategy: 'in-memory-manifest' | 'filesystem-copy';
  };
}

export interface FileTransformResult {
  path: string;
  changed: boolean;
  appliedRuleIds: string[];
  beforeHash: string;
  afterHash: string;
  preview: {
    beforeSnippet: string;
    afterSnippet: string;
  };
  outputContent?: string;
}

export interface RuleSelectionDecision {
  ruleId: string;
  selected: boolean;
  confidence: number;
  reason: string;
}

export interface RuleTransformPlan {
  mode: 'preview' | 'apply';
  deterministicRuleOrder: string[];
  backupPlan: {
    enabled: boolean;
    strategy: 'in-memory-manifest' | 'filesystem-copy';
    manifestId: string;
    rollbackInstructions: string[];
  };
  summary: {
    filesScanned: number;
    filesChanged: number;
    totalRuleApplications: number;
  };
  matchedKnowledgeEntryIds: string[];
  ruleDecisions: RuleSelectionDecision[];
  warnings: string[];
  results: FileTransformResult[];
}

export interface OAuthDeviceStartResult {
  verificationUri: string;
  verificationUriComplete?: string;
  userCode: string;
  deviceCode: string;
  intervalSeconds: number;
  expiresInSeconds: number;
}

export interface StoredSecret {
  value: string;
  createdAt: number;
  updatedAt: number;
}
