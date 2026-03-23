import { useEffect, useMemo, useRef, useState } from 'react';
import type { AIProvider, CompatibilityReport, ParsedModMetadata, RuleTransformPlan } from './lib/types/contracts';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

type LogEntry = {
  id: number;
  timestamp: number;
  level: LogLevel;
  message: string;
};

type UiSettings = {
  showTerminal: boolean;
  autoScrollTerminal: boolean;
  clearLogsOnStart: boolean;
  verboseLogging: boolean;
};

const DEFAULT_SETTINGS: UiSettings = {
  showTerminal: true,
  autoScrollTerminal: true,
  clearLogsOnStart: false,
  verboseLogging: false
};

const SAMPLE_FORGE = `[mods]
modLoader="javafml"
loaderVersion="[47,)"
license="MIT"

[[mods]]
modId="sampleforge"
version="1.0.0"
displayName="Sample Forge"

[[dependencies.sampleforge]]
modId="minecraft"
mandatory=true
versionRange="[1.20,1.20.2)"
ordering="NONE"
side="BOTH"`;

const SAMPLE_FABRIC = `{
  "schemaVersion": 1,
  "id": "samplefabric",
  "version": "1.0.0",
  "name": "Sample Fabric",
  "depends": {
    "fabricloader": ">=0.15.0",
    "minecraft": "~1.20.1"
  }
}`;

const SAMPLE_CODE = `import net.minecraft.world.item.CreativeModeTab;
import net.minecraftforge.registries.RegistryObject;

public class ExampleMod {
  RegistryObject<Item> ITEM = ITEMS.register("x", () -> new Item(new Item.Properties()));
  public static final ResourceLocation ID = new ResourceLocation("example", "thing");
}`;

function formatLogTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function App() {
  const [forgeToml, setForgeToml] = useState(SAMPLE_FORGE);
  const [fabricJson, setFabricJson] = useState(SAMPLE_FABRIC);
  const [metadata, setMetadata] = useState<ParsedModMetadata[]>([]);
  const [targetVersion, setTargetVersion] = useState('1.20.4');
  const [sourceLoader, setSourceLoader] = useState<'forge' | 'fabric'>('forge');
  const [targetLoader, setTargetLoader] = useState<'forge' | 'fabric'>('forge');
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [token, setToken] = useState('');
  const [openAIClientId, setOpenAIClientId] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [oauthLog, setOauthLog] = useState('');
  const [goals, setGoals] = useState('Keep behavior stable and prioritize compile-time break fixes.');
  const [reportText, setReportText] = useState('');
  const [compatibilityReport, setCompatibilityReport] = useState<CompatibilityReport | null>(null);
  const [planText, setPlanText] = useState('');
  const [codeInput, setCodeInput] = useState(SAMPLE_CODE);
  const [transformPlan, setTransformPlan] = useState<RuleTransformPlan | null>(null);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(1);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const pushLog = (level: LogLevel, message: string) => {
    if (level === 'debug' && !settings.verboseLogging) {
      return;
    }
    setLogs((current) => [
      ...current,
      {
        id: logIdRef.current++,
        timestamp: Date.now(),
        level,
        message
      }
    ]);
  };

  useEffect(() => {
    if (settings.clearLogsOnStart) {
      setLogs([]);
      return;
    }
    pushLog('info', 'App ready. Start by parsing metadata or configuring credentials.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.showTerminal || !settings.autoScrollTerminal) return;
    const element = terminalRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [logs, settings.showTerminal, settings.autoScrollTerminal]);

  const request = useMemo(
    () => ({ source: metadata, target: { minecraftVersion: targetVersion, loader: targetLoader }, userGoals: goals }),
    [metadata, targetVersion, targetLoader, goals]
  );

  async function onParse() {
    try {
      pushLog('info', 'Parse started: reading mods.toml and fabric.mod.json.');
      const parsed = await window.mcModConverter.parseMetadata([
        { name: 'mods.toml', content: forgeToml },
        { name: 'fabric.mod.json', content: fabricJson }
      ]);
      setMetadata(parsed);
      pushLog('success', `Parse complete: discovered ${parsed.length} metadata record(s).`);
    } catch (error) {
      pushLog('error', `Parse failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onAnalyze() {
    try {
      pushLog('info', `Compatibility analysis started for ${targetLoader} ${targetVersion}.`);
      pushLog('debug', `Request metadata count: ${request.source.length}.`);
      const report = await window.mcModConverter.analyzeCompatibility(request);
      setCompatibilityReport(report);
      setReportText(JSON.stringify(report, null, 2));
      pushLog('success', `Analysis complete: score ${report.score}/100, confidence ${(report.confidence * 100).toFixed(1)}%.`);
    } catch (error) {
      pushLog('error', `Analyze failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onGeneratePlan() {
    try {
      pushLog('info', `AI plan started with provider ${provider}.`);
      const prompt = await window.mcModConverter.buildPrompt(request);
      pushLog('debug', `Prompt generated (${prompt.length} chars).`);
      const plan = await window.mcModConverter.generatePlan({
        provider,
        credentials: {
          apiKey: token,
          oauthAccessToken: provider === 'openai' ? token : undefined
        },
        prompt
      });
      setPlanText(plan);
      pushLog('success', 'AI plan received and rendered.');
    } catch (error) {
      pushLog('error', `AI plan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onTransformStub() {
    try {
      pushLog('info', 'Safe transform stub started.');
      const result = await window.mcModConverter.transformStub(request);
      setReportText(JSON.stringify(result, null, 2));
      pushLog('success', 'Safe transform stub completed.');
    } catch (error) {
      pushLog('error', `Transform stub failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onPreviewRules() {
    try {
      pushLog('info', 'Rules preview started (no file changes).');
      const plan = await window.mcModConverter.runRulesTransform({
        files: [{ path: 'ExampleMod.java', content: codeInput }],
        sourceLoader,
        targetLoader,
        targetMinecraftVersion: targetVersion,
        mode: 'preview',
        backup: { enabled: true, strategy: 'in-memory-manifest' }
      });
      setTransformPlan(plan);
      pushLog('success', `Rules preview complete: ${plan.results.length} file(s) inspected.`);
    } catch (error) {
      pushLog('error', `Rules preview failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onApplyRules() {
    try {
      pushLog('info', 'Rules apply started (updating code editor output).');
      const plan = await window.mcModConverter.runRulesTransform({
        files: [{ path: 'ExampleMod.java', content: codeInput }],
        sourceLoader,
        targetLoader,
        targetMinecraftVersion: targetVersion,
        mode: 'apply',
        backup: { enabled: true, strategy: 'in-memory-manifest' }
      });
      const next = plan.results[0]?.outputContent;
      if (next) {
        setCodeInput(next);
        pushLog('debug', 'Editor content replaced with transformed output for ExampleMod.java.');
      }
      setTransformPlan(plan);
      pushLog('success', `Rules apply complete: ${plan.results.length} file(s) processed.`);
    } catch (error) {
      pushLog('error', `Rules apply failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onSaveSecret() {
    if (!token) {
      pushLog('warn', 'Save credential skipped: token is empty.');
      return;
    }
    try {
      pushLog('info', `Saving ${provider} credential to local encrypted store.`);
      await window.mcModConverter.setSecret(provider, token);
      setOauthLog(`Stored ${provider} credential in local encrypted store.`);
      pushLog('success', `${provider} credential saved.`);
    } catch (error) {
      pushLog('error', `Save credential failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onLoadSecret() {
    try {
      pushLog('info', `Loading stored ${provider} credential.`);
      const stored = await window.mcModConverter.getSecret(provider);
      setToken(stored?.value ?? '');
      setOauthLog(stored ? `Loaded ${provider} credential (updated ${new Date(stored.updatedAt).toISOString()}).` : 'No stored credential.');
      pushLog(stored ? 'success' : 'warn', stored ? `${provider} credential loaded.` : `No stored ${provider} credential found.`);
    } catch (error) {
      pushLog('error', `Load credential failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onClearSecret() {
    try {
      pushLog('info', `Clearing ${provider} credential.`);
      await window.mcModConverter.clearSecret(provider);
      setToken('');
      setOauthLog(`Cleared ${provider} credential.`);
      pushLog('success', `${provider} credential cleared.`);
    } catch (error) {
      pushLog('error', `Clear credential failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onStartDeviceFlow() {
    try {
      pushLog('info', 'OpenAI OAuth device flow start requested.');
      const flow = await window.mcModConverter.startOpenAIDeviceFlow({ clientId: openAIClientId, openBrowser: true });
      setDeviceCode(flow.deviceCode);
      setOauthLog(`OpenAI device flow started. User code: ${flow.userCode}. Expires in ${flow.expiresInSeconds}s.`);
      pushLog('success', `OAuth started. User code ${flow.userCode}, expires in ${flow.expiresInSeconds}s.`);
    } catch (error) {
      pushLog('error', `OAuth start failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onPollDeviceFlow() {
    try {
      pushLog('info', 'Polling OpenAI OAuth device flow for token.');
      const tokenResult = await window.mcModConverter.pollOpenAIDeviceFlow({ clientId: openAIClientId, deviceCode });
      setToken(tokenResult.access_token);
      await window.mcModConverter.setSecret('openai', tokenResult.access_token);
      setOauthLog('OpenAI OAuth token received and stored.');
      pushLog('success', 'OAuth token received and saved to secret store.');
    } catch (error) {
      pushLog('error', `OAuth poll failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function onClearLogs() {
    setLogs([]);
  }

  function updateSetting<K extends keyof UiSettings>(key: K, value: UiSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="container">
      <div className="title-row">
        <div>
          <h1>MC Mod Converter AI</h1>
          <p className="subtle">Metadata parsing, compatibility analysis, AI planning, deterministic transform previews, and local credential vault.</p>
        </div>
        <div className="actions compact">
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
          <button onClick={() => updateSetting('showTerminal', !settings.showTerminal)}>
            {settings.showTerminal ? 'Hide Terminal' : 'Show Terminal'}
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <section className="panel settings-panel">
          <div className="settings-header">
            <h2>Settings</h2>
            <button onClick={() => setSettingsOpen(false)}>Close</button>
          </div>
          <div className="settings-grid">
            <label><input type="checkbox" checked={settings.showTerminal} onChange={(e) => updateSetting('showTerminal', e.target.checked)} /> Show terminal panel</label>
            <label><input type="checkbox" checked={settings.autoScrollTerminal} onChange={(e) => updateSetting('autoScrollTerminal', e.target.checked)} /> Auto-scroll terminal</label>
            <label><input type="checkbox" checked={settings.clearLogsOnStart} onChange={(e) => updateSetting('clearLogsOnStart', e.target.checked)} /> Clear logs on app start</label>
            <label><input type="checkbox" checked={settings.verboseLogging} onChange={(e) => updateSetting('verboseLogging', e.target.checked)} /> Verbose logging (show debug logs)</label>
          </div>
          <p className="subtle">These settings apply immediately for this session.</p>
        </section>
      ) : null}

      {settings.showTerminal ? (
        <section className="panel terminal-panel">
          <div className="terminal-header">
            <h2>Terminal</h2>
            <div className="actions compact">
              <button onClick={onClearLogs}>Clear Logs</button>
            </div>
          </div>
          <div className="terminal-log" ref={terminalRef}>
            {logs.length === 0 ? <p className="subtle">No logs yet.</p> : null}
            {logs.map((entry) => (
              <div key={entry.id} className={`log-line ${entry.level}`}>
                <span className="log-time">[{formatLogTime(entry.timestamp)}]</span>
                <span className="log-level">{entry.level.toUpperCase()}</span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid two">
        <section>
          <h2>Forge mods.toml</h2>
          <textarea value={forgeToml} onChange={(e) => setForgeToml(e.target.value)} />
        </section>
        <section>
          <h2>Fabric fabric.mod.json</h2>
          <textarea value={fabricJson} onChange={(e) => setFabricJson(e.target.value)} />
        </section>
      </div>

      <div className="grid controls">
        <label>Target MC Version<input value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)} /></label>
        <label>Source Loader<select value={sourceLoader} onChange={(e) => setSourceLoader(e.target.value as 'forge' | 'fabric')}><option value="forge">Forge</option><option value="fabric">Fabric</option></select></label>
        <label>Target Loader<select value={targetLoader} onChange={(e) => setTargetLoader(e.target.value as 'forge' | 'fabric')}><option value="forge">Forge</option><option value="fabric">Fabric</option></select></label>
        <label>AI Provider<select value={provider} onChange={(e) => setProvider(e.target.value as AIProvider)}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select></label>
      </div>

      <label>Credential (API key or OAuth token)
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste key/token" />
      </label>
      <div className="actions">
        <button onClick={onSaveSecret}>Save Credential</button>
        <button onClick={onLoadSecret}>Load Stored Credential</button>
        <button onClick={onClearSecret}>Clear Stored Credential</button>
      </div>

      <label>OpenAI OAuth Client ID (for device flow)
        <input value={openAIClientId} onChange={(e) => setOpenAIClientId(e.target.value)} placeholder="OpenAI OAuth client_id" />
      </label>
      <div className="actions">
        <button onClick={onStartDeviceFlow} disabled={!openAIClientId}>Start OpenAI Device Flow</button>
        <button onClick={onPollDeviceFlow} disabled={!openAIClientId || !deviceCode}>Poll Device Token</button>
      </div>
      <pre>{oauthLog || 'OAuth status will appear here.'}</pre>

      <label>Migration goals<textarea value={goals} onChange={(e) => setGoals(e.target.value)} /></label>

      <div className="actions">
        <button onClick={onParse}>1) Parse Metadata</button>
        <button onClick={onAnalyze}>2) Analyze Compatibility</button>
        <button onClick={onGeneratePlan}>3) Ask AI for Plan</button>
        <button onClick={onTransformStub}>4) Safe Transform Stub</button>
      </div>

      <h2>Deterministic Rules Engine (preview-first)</h2>
      <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
      <div className="actions">
        <button onClick={onPreviewRules}>Preview Rules</button>
        <button onClick={onApplyRules}>Apply Rules</button>
      </div>

      <div className="grid two">
        <section>
          <h2>Parsed Metadata</h2>
          <pre>{JSON.stringify(metadata, null, 2)}</pre>
        </section>
        <section>
          <h2>Compatibility / Transform Output</h2>
          {compatibilityReport ? (
            <div>
              <p><strong>Score:</strong> {compatibilityReport.score} / 100</p>
              <p><strong>Confidence:</strong> {(compatibilityReport.confidence * 100).toFixed(1)}%</p>
              <p><strong>Summary:</strong> {compatibilityReport.summary}</p>
              <p><strong>Matched knowledge:</strong> {compatibilityReport.matchedKnowledgeEntryIds.join(', ') || 'none'}</p>
              <p><strong>Confidence factors:</strong></p>
              <ul>
                {compatibilityReport.confidenceFactors.map((factor) => (
                  <li key={`${factor.label}-${factor.detail}`}>
                    {factor.label} ({factor.impact >= 0 ? '+' : ''}{(factor.impact * 100).toFixed(1)}%): {factor.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <pre>{reportText || 'Run compatibility analysis or transform stub.'}</pre>
        </section>
      </div>

      <section>
        <h2>Rules Plan</h2>
        {transformPlan ? (
          <div>
            <p><strong>Matched knowledge:</strong> {transformPlan.matchedKnowledgeEntryIds.join(', ') || 'none'}</p>
            <p><strong>Rule decisions:</strong></p>
            <ul>
              {transformPlan.ruleDecisions.map((decision) => (
                <li key={decision.ruleId}>
                  {decision.ruleId} — {decision.selected ? 'selected' : 'skipped'} ({(decision.confidence * 100).toFixed(0)}%): {decision.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <pre>{transformPlan ? JSON.stringify(transformPlan, null, 2) : 'Run preview/apply to inspect deterministic rule output.'}</pre>
      </section>

      <section>
        <h2>AI Conversion Plan Output</h2>
        <pre>{planText || 'Generate plan after parsing metadata.'}</pre>
      </section>
    </div>
  );
}
