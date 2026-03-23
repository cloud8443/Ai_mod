import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { parseModMetadataFromFiles } from '../src/lib/parsers/modMetadata.js';
import { analyzeCompatibility } from '../src/lib/analysis/compatibility.js';
import { buildConversionPrompt } from '../src/lib/prompts/conversionPrompt.js';
import { createProviderClient } from '../src/lib/ai/providers.js';
import { safeTransformStub } from '../src/lib/transform/safeTransform.js';
import { runDeterministicRuleTransform } from '../src/lib/transform/rulesEngine.js';
import { LocalTokenStore } from './tokenStore.js';
import { pollOpenAIDeviceToken, startOpenAIDeviceFlow } from './openaiOAuth.js';
import type { AIProvider, AIRequest, ConversionRequest, RuleTransformRequest } from '../src/lib/types/contracts.js';

const tokenStore = new LocalTokenStore();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Packaged path: resources/app.asar/dist-electron/electron/main.js
    // Renderer lives at: resources/app.asar/dist/index.html
    const rendererPath = path.join(__dirname, '../../dist/index.html');
    win.loadFile(rendererPath);
  }
}

ipcMain.handle('mods:parseMetadata', async (_event, files: { name: string; content: string }[]) => {
  return parseModMetadataFromFiles(files);
});

ipcMain.handle('mods:analyzeCompatibility', async (_event, req: ConversionRequest) => {
  return analyzeCompatibility(req.source, req.target);
});

ipcMain.handle('ai:buildPrompt', async (_event, req: ConversionRequest) => {
  return buildConversionPrompt(req);
});

ipcMain.handle('ai:generatePlan', async (_event, req: AIRequest) => {
  const stored = await tokenStore.get(req.provider);
  const provider = createProviderClient(req.provider, {
    ...req.credentials,
    apiKey: req.credentials.apiKey || (req.provider !== 'openai' ? stored?.value : undefined),
    oauthAccessToken: req.credentials.oauthAccessToken || (req.provider === 'openai' ? stored?.value : undefined)
  });
  return provider.generatePlan(req.prompt);
});

ipcMain.handle('mods:transformStub', async (_event, req: ConversionRequest) => {
  return safeTransformStub(req);
});

ipcMain.handle('mods:runRulesTransform', async (_event, req: RuleTransformRequest) => {
  return runDeterministicRuleTransform(req);
});

ipcMain.handle('auth:secrets:set', async (_event, provider: AIProvider, value: string) => {
  return tokenStore.set(provider, value);
});

ipcMain.handle('auth:secrets:get', async (_event, provider: AIProvider) => {
  return tokenStore.get(provider);
});

ipcMain.handle('auth:secrets:clear', async (_event, provider: AIProvider) => {
  await tokenStore.clear(provider);
  return { ok: true };
});

ipcMain.handle('auth:openai:startDevice', async (_event, params: { clientId: string; openBrowser: boolean }) => {
  const start = await startOpenAIDeviceFlow(params.clientId);
  if (params.openBrowser) {
    await shell.openExternal(start.verificationUriComplete ?? start.verificationUri);
  }
  return start;
});

ipcMain.handle('auth:openai:pollDevice', async (_event, params: { clientId: string; deviceCode: string }) => {
  return pollOpenAIDeviceToken(params);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
