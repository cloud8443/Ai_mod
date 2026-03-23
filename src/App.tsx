import { useMemo, useState } from 'react';
import type { AIProvider, ParsedModMetadata, RuleTransformPlan } from './lib/types/contracts';

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
  const [planText, setPlanText] = useState('');
  const [codeInput, setCodeInput] = useState(SAMPLE_CODE);
  const [transformPlan, setTransformPlan] = useState<RuleTransformPlan | null>(null);

  const request = useMemo(
    () => ({ source: metadata, target: { minecraftVersion: targetVersion, loader: targetLoader }, userGoals: goals }),
    [metadata, targetVersion, targetLoader, goals]
  );

  async function onParse() {
    const parsed = await window.mcModConverter.parseMetadata([
      { name: 'mods.toml', content: forgeToml },
      { name: 'fabric.mod.json', content: fabricJson }
    ]);
    setMetadata(parsed);
  }

  async function onAnalyze() {
    const report = await window.mcModConverter.analyzeCompatibility(request);
    setReportText(JSON.stringify(report, null, 2));
  }

  async function onGeneratePlan() {
    const prompt = await window.mcModConverter.buildPrompt(request);
    const plan = await window.mcModConverter.generatePlan({
      provider,
      credentials: {
        apiKey: token,
        oauthAccessToken: provider === 'openai' ? token : undefined
      },
      prompt
    });
    setPlanText(plan);
  }

  async function onTransformStub() {
    const result = await window.mcModConverter.transformStub(request);
    setReportText(JSON.stringify(result, null, 2));
  }

  async function onPreviewRules() {
    const plan = await window.mcModConverter.runRulesTransform({
      files: [{ path: 'ExampleMod.java', content: codeInput }],
      sourceLoader,
      targetLoader,
      targetMinecraftVersion: targetVersion,
      mode: 'preview',
      backup: { enabled: true, strategy: 'in-memory-manifest' }
    });
    setTransformPlan(plan);
  }

  async function onApplyRules() {
    const plan = await window.mcModConverter.runRulesTransform({
      files: [{ path: 'ExampleMod.java', content: codeInput }],
      sourceLoader,
      targetLoader,
      targetMinecraftVersion: targetVersion,
      mode: 'apply',
      backup: { enabled: true, strategy: 'in-memory-manifest' }
    });
    const next = plan.results[0]?.outputContent;
    if (next) setCodeInput(next);
    setTransformPlan(plan);
  }

  async function onSaveSecret() {
    if (!token) return;
    await window.mcModConverter.setSecret(provider, token);
    setOauthLog(`Stored ${provider} credential in local encrypted store.`);
  }

  async function onLoadSecret() {
    const stored = await window.mcModConverter.getSecret(provider);
    setToken(stored?.value ?? '');
    setOauthLog(stored ? `Loaded ${provider} credential (updated ${new Date(stored.updatedAt).toISOString()}).` : 'No stored credential.');
  }

  async function onClearSecret() {
    await window.mcModConverter.clearSecret(provider);
    setToken('');
    setOauthLog(`Cleared ${provider} credential.`);
  }

  async function onStartDeviceFlow() {
    const flow = await window.mcModConverter.startOpenAIDeviceFlow({ clientId: openAIClientId, openBrowser: true });
    setDeviceCode(flow.deviceCode);
    setOauthLog(`OpenAI device flow started. User code: ${flow.userCode}. Expires in ${flow.expiresInSeconds}s.`);
  }

  async function onPollDeviceFlow() {
    const tokenResult = await window.mcModConverter.pollOpenAIDeviceFlow({ clientId: openAIClientId, deviceCode });
    setToken(tokenResult.access_token);
    await window.mcModConverter.setSecret('openai', tokenResult.access_token);
    setOauthLog('OpenAI OAuth token received and stored.');
  }

  return (
    <div className="container">
      <h1>MC Mod Converter AI</h1>
      <p className="subtle">Metadata parsing, compatibility analysis, AI planning, deterministic transform previews, and local credential vault.</p>

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
          <h2>Report / Transform Result</h2>
          <pre>{reportText || 'Run compatibility analysis or transform stub.'}</pre>
        </section>
      </div>

      <section>
        <h2>Rules Plan</h2>
        <pre>{transformPlan ? JSON.stringify(transformPlan, null, 2) : 'Run preview/apply to inspect deterministic rule output.'}</pre>
      </section>

      <section>
        <h2>AI Conversion Plan Output</h2>
        <pre>{planText || 'Generate plan after parsing metadata.'}</pre>
      </section>
    </div>
  );
}
