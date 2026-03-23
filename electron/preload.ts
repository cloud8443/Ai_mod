import { contextBridge, ipcRenderer } from 'electron';
import type {
  AIProvider,
  AIRequest,
  ConversionRequest,
  ParsedModMetadata,
  RuleTransformPlan,
  RuleTransformRequest,
  StoredSecret
} from '../src/lib/types/contracts.js';

type InputFile = { name: string; content: string };

const api = {
  parseMetadata: (files: InputFile[]): Promise<ParsedModMetadata[]> => ipcRenderer.invoke('mods:parseMetadata', files),
  analyzeCompatibility: (request: ConversionRequest) => ipcRenderer.invoke('mods:analyzeCompatibility', request),
  buildPrompt: (request: ConversionRequest): Promise<string> => ipcRenderer.invoke('ai:buildPrompt', request),
  generatePlan: (request: AIRequest): Promise<string> => ipcRenderer.invoke('ai:generatePlan', request),
  transformStub: (request: ConversionRequest) => ipcRenderer.invoke('mods:transformStub', request),
  runRulesTransform: (request: RuleTransformRequest): Promise<RuleTransformPlan> =>
    ipcRenderer.invoke('mods:runRulesTransform', request),
  setSecret: (provider: AIProvider, value: string): Promise<StoredSecret> => ipcRenderer.invoke('auth:secrets:set', provider, value),
  getSecret: (provider: AIProvider): Promise<StoredSecret | null> => ipcRenderer.invoke('auth:secrets:get', provider),
  clearSecret: (provider: AIProvider): Promise<{ ok: boolean }> => ipcRenderer.invoke('auth:secrets:clear', provider),
  startOpenAIDeviceFlow: (params: { clientId: string; openBrowser: boolean }) => ipcRenderer.invoke('auth:openai:startDevice', params),
  pollOpenAIDeviceFlow: (params: { clientId: string; deviceCode: string }) => ipcRenderer.invoke('auth:openai:pollDevice', params)
};

contextBridge.exposeInMainWorld('mcModConverter', api);
