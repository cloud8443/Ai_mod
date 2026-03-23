import { useEffect, useMemo, useRef, useState } from 'react';
import type { AIProvider, CompatibilityReport, ParsedModMetadata, RuleTransformPlan } from './lib/types/contracts';

type Loader = 'forge' | 'fabric';
type Lang = 'en' | 'ko';
type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';
type Step = 1 | 2 | 3 | 4;

type LogEntry = { id: number; timestamp: number; level: LogLevel; message: string };

type UiSettings = {
  language: Lang;
  showTerminal: boolean;
  autoScrollTerminal: boolean;
  verboseLogging: boolean;
};

const DEFAULT_SETTINGS: UiSettings = { language: 'en', showTerminal: false, autoScrollTerminal: true, verboseLogging: false };

const TEXT = {
  en: {
    appTitle: 'MC Mod Converter AI',
    appSubtitle: 'Beginner-friendly wizard for same-loader Minecraft mod upgrades.',
    settings: 'Settings', close: 'Close', language: 'Language', showTerminal: 'Show terminal panel',
    verbose: 'Verbose terminal logs',
    step1: 'Step 1: Project basics', step2: 'Step 2: Parse & check', step3: 'Step 3: AI login & plan', step4: 'Step 4: Rules preview',
    sourceLoader: 'Your current mod loader', targetLoader: 'Target mod loader (must be same)', targetVersion: 'Target Minecraft version',
    goals: 'What do you want to prioritize?', parse: 'Parse metadata', analyze: 'Run compatibility check',
    oauthClientId: 'OpenAI OAuth Client ID', redirectUri: 'Redirect URI', startAuth: 'Generate approval link',
    openLink: 'Open approval link', completeAuth: 'Complete login', callbackInput: 'Paste callback URL or authorization code',
    saveCred: 'Save token', loadCred: 'Load token', clearCred: 'Clear token', plan: 'Generate AI plan',
    previewRules: 'Preview rules', applyRules: 'Apply rules to editor', next: 'Next', back: 'Back',
    blocked: 'Cross-loader conversion is disabled. Choose the same loader for source and target.',
    terminal: 'Terminal', noLogs: 'No logs yet.'
  },
  ko: {
    appTitle: 'MC 모드 컨버터 AI',
    appSubtitle: '같은 로더 내 버전 업그레이드를 위한 쉬운 마법사 UI입니다.',
    settings: '설정', close: '닫기', language: '언어', showTerminal: '터미널 패널 표시',
    verbose: '상세 터미널 로그',
    step1: '1단계: 기본 설정', step2: '2단계: 메타데이터 파싱/점검', step3: '3단계: AI 로그인/계획', step4: '4단계: 규칙 미리보기',
    sourceLoader: '현재 모드 로더', targetLoader: '대상 모드 로더 (같아야 함)', targetVersion: '대상 마인크래프트 버전',
    goals: '우선순위를 적어주세요', parse: '메타데이터 파싱', analyze: '호환성 점검 실행',
    oauthClientId: 'OpenAI OAuth 클라이언트 ID', redirectUri: '리다이렉트 URI', startAuth: '승인 링크 생성',
    openLink: '승인 링크 열기', completeAuth: '로그인 완료', callbackInput: '콜백 URL 또는 인증 코드를 붙여넣기',
    saveCred: '토큰 저장', loadCred: '토큰 불러오기', clearCred: '토큰 삭제', plan: 'AI 계획 생성',
    previewRules: '규칙 미리보기', applyRules: '에디터에 규칙 적용', next: '다음', back: '이전',
    blocked: '크로스 로더 변환은 비활성화되었습니다. 소스와 대상 로더를 같게 설정하세요.',
    terminal: '터미널', noLogs: '로그가 없습니다.'
  }
} as const;

const SAMPLE_FORGE = `[mods]\nmodLoader="javafml"\nloaderVersion="[47,)"\n\n[[mods]]\nmodId="sampleforge"\nversion="1.0.0"`;
const SAMPLE_FABRIC = `{"schemaVersion":1,"id":"samplefabric","version":"1.0.0"}`;
const SAMPLE_CODE = `import net.minecraft.resources.ResourceLocation;\nnew ResourceLocation("example", "thing");`;

const fmt = (t: number) => new Date(t).toLocaleTimeString();

export function App() {
  const [forgeToml, setForgeToml] = useState(SAMPLE_FORGE);
  const [fabricJson, setFabricJson] = useState(SAMPLE_FABRIC);
  const [metadata, setMetadata] = useState<ParsedModMetadata[]>([]);
  const [targetVersion, setTargetVersion] = useState('1.20.4');
  const [sourceLoader, setSourceLoader] = useState<Loader>('forge');
  const [targetLoader, setTargetLoader] = useState<Loader>('forge');
  const [provider] = useState<AIProvider>('openai');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('https://localhost/callback');
  const [authUrl, setAuthUrl] = useState('');
  const [codeOrUrl, setCodeOrUrl] = useState('');
  const [oauthLog, setOauthLog] = useState('');
  const [goals, setGoals] = useState('Keep behavior stable, fix compile issues first.');
  const [reportText, setReportText] = useState('');
  const [compatibilityReport, setCompatibilityReport] = useState<CompatibilityReport | null>(null);
  const [planText, setPlanText] = useState('');
  const [codeInput, setCodeInput] = useState(SAMPLE_CODE);
  const [transformPlan, setTransformPlan] = useState<RuleTransformPlan | null>(null);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [step, setStep] = useState<Step>(1);
  const logIdRef = useRef(1);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const t = TEXT[settings.language];
  const migrationBlocked = sourceLoader !== targetLoader;

  const request = useMemo(() => ({ source: metadata, target: { minecraftVersion: targetVersion, loader: targetLoader }, userGoals: goals }), [metadata, targetVersion, targetLoader, goals]);

  const pushLog = (level: LogLevel, message: string) => {
    if (level === 'debug' && !settings.verboseLogging) return;
    setLogs((cur) => [...cur, { id: logIdRef.current++, timestamp: Date.now(), level, message }]);
  };

  useEffect(() => {
    pushLog('info', 'Ready. Follow the wizard from Step 1.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.showTerminal || !settings.autoScrollTerminal) return;
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs, settings.showTerminal, settings.autoScrollTerminal]);

  async function onParse() {
    const parsed = await window.mcModConverter.parseMetadata([{ name: 'mods.toml', content: forgeToml }, { name: 'fabric.mod.json', content: fabricJson }]);
    setMetadata(parsed);
    pushLog('success', `Parsed ${parsed.length} metadata entries.`);
  }

  async function onAnalyze() {
    if (migrationBlocked) throw new Error(t.blocked);
    const report = await window.mcModConverter.analyzeCompatibility(request);
    setCompatibilityReport(report);
    setReportText(JSON.stringify(report, null, 2));
    pushLog('success', `Compatibility score: ${report.score}/100`);
  }

  async function onStartAuth() {
    const flow = await window.mcModConverter.startOpenAILinkFlow({ clientId, redirectUri, openBrowser: false });
    setAuthUrl(flow.authorizationUrl);
    setOauthLog(`Approval link ready. Open it, approve access, then paste callback URL or code below.`);
  }

  async function onCompleteAuth() {
    const tokenResult = await window.mcModConverter.completeOpenAILinkFlow({ clientId, codeOrCallbackUrl: codeOrUrl });
    setToken(tokenResult.access_token);
    await window.mcModConverter.setSecret('openai', tokenResult.access_token);
    setOauthLog('Login completed. Access token saved locally.');
  }

  async function onGeneratePlan() {
    if (migrationBlocked) throw new Error(t.blocked);
    const prompt = await window.mcModConverter.buildPrompt(request);
    const plan = await window.mcModConverter.generatePlan({ provider, credentials: { oauthAccessToken: token }, prompt });
    setPlanText(plan);
  }

  async function onPreviewRules() {
    if (migrationBlocked) throw new Error(t.blocked);
    const plan = await window.mcModConverter.runRulesTransform({
      files: [{ path: 'ExampleMod.java', content: codeInput }], sourceLoader, targetLoader,
      targetMinecraftVersion: targetVersion, mode: 'preview', backup: { enabled: true, strategy: 'in-memory-manifest' }
    });
    setTransformPlan(plan);
  }

  async function onApplyRules() {
    if (migrationBlocked) throw new Error(t.blocked);
    const plan = await window.mcModConverter.runRulesTransform({
      files: [{ path: 'ExampleMod.java', content: codeInput }], sourceLoader, targetLoader,
      targetMinecraftVersion: targetVersion, mode: 'apply', backup: { enabled: true, strategy: 'in-memory-manifest' }
    });
    if (plan.results[0]?.outputContent) setCodeInput(plan.results[0].outputContent);
    setTransformPlan(plan);
  }

  async function wrap(name: string, fn: () => Promise<void>) {
    try { pushLog('info', name); await fn(); pushLog('success', `${name} done.`); }
    catch (e) { pushLog('error', e instanceof Error ? e.message : String(e)); }
  }

  const nav = <div className="actions"><button disabled={step === 1} onClick={() => setStep((s) => (s - 1) as Step)}>{t.back}</button><button disabled={step === 4} onClick={() => setStep((s) => (s + 1) as Step)}>{t.next}</button></div>;

  return <div className="container">
    <div className="title-row"><div><h1>{t.appTitle}</h1><p className="subtle">{t.appSubtitle}</p></div><button onClick={() => setSettingsOpen(true)}>{t.settings}</button></div>

    {settingsOpen && <section className="panel settings-panel">
      <div className="settings-header"><h2>{t.settings}</h2><button onClick={() => setSettingsOpen(false)}>{t.close}</button></div>
      <label>{t.language}<select value={settings.language} onChange={(e) => setSettings((c) => ({ ...c, language: e.target.value as Lang }))}><option value="en">English</option><option value="ko">한국어</option></select></label>
      <label><input type="checkbox" checked={settings.showTerminal} onChange={(e) => setSettings((c) => ({ ...c, showTerminal: e.target.checked }))} /> {t.showTerminal}</label>
      <label><input type="checkbox" checked={settings.verboseLogging} onChange={(e) => setSettings((c) => ({ ...c, verboseLogging: e.target.checked }))} /> {t.verbose}</label>
    </section>}

    {migrationBlocked && <section className="panel"><strong>{t.blocked}</strong></section>}

    <section className="panel"><h2>{t.step1}</h2>
      <div className="grid controls three">
        <label>{t.sourceLoader}<select value={sourceLoader} onChange={(e) => { const v = e.target.value as Loader; setSourceLoader(v); setTargetLoader(v); }}><option value="forge">Forge</option><option value="fabric">Fabric</option></select></label>
        <label>{t.targetLoader}<select value={targetLoader} onChange={(e) => setTargetLoader(e.target.value as Loader)}><option value="forge">Forge</option><option value="fabric">Fabric</option></select></label>
        <label>{t.targetVersion}<input value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)} /></label>
      </div>
      <label>{t.goals}<textarea value={goals} onChange={(e) => setGoals(e.target.value)} /></label>
    </section>

    {step >= 2 && <section className="panel"><h2>{t.step2}</h2>
      <div className="grid two"><section><h3>Forge mods.toml</h3><textarea value={forgeToml} onChange={(e) => setForgeToml(e.target.value)} /></section><section><h3>Fabric fabric.mod.json</h3><textarea value={fabricJson} onChange={(e) => setFabricJson(e.target.value)} /></section></div>
      <div className="actions"><button onClick={() => wrap(t.parse, onParse)}>{t.parse}</button><button onClick={() => wrap(t.analyze, onAnalyze)}>{t.analyze}</button></div>
      <pre>{reportText || 'Run parse and analysis.'}</pre>
    </section>}

    {step >= 3 && <section className="panel"><h2>{t.step3}</h2>
      <label>{t.oauthClientId}<input value={clientId} onChange={(e) => setClientId(e.target.value)} /></label>
      <label>{t.redirectUri}<input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} /></label>
      <label>{t.callbackInput}<input value={codeOrUrl} onChange={(e) => setCodeOrUrl(e.target.value)} /></label>
      <div className="actions">
        <button disabled={!clientId} onClick={() => wrap(t.startAuth, onStartAuth)}>{t.startAuth}</button>
        <button disabled={!authUrl} onClick={() => window.open(authUrl, '_blank')}>{t.openLink}</button>
        <button disabled={!clientId || !codeOrUrl} onClick={() => wrap(t.completeAuth, onCompleteAuth)}>{t.completeAuth}</button>
      </div>
      <pre>{oauthLog || 'OAuth status will appear here.'}</pre>
      <div className="actions">
        <button onClick={() => wrap(t.saveCred, async () => { if (token) await window.mcModConverter.setSecret('openai', token); })}>{t.saveCred}</button>
        <button onClick={() => wrap(t.loadCred, async () => { const s = await window.mcModConverter.getSecret('openai'); setToken(s?.value ?? ''); })}>{t.loadCred}</button>
        <button onClick={() => wrap(t.clearCred, async () => { await window.mcModConverter.clearSecret('openai'); setToken(''); })}>{t.clearCred}</button>
        <button disabled={!token} onClick={() => wrap(t.plan, onGeneratePlan)}>{t.plan}</button>
      </div>
      <pre>{planText || 'Generate plan after login.'}</pre>
    </section>}

    {step >= 4 && <section className="panel"><h2>{t.step4}</h2>
      <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
      <div className="actions"><button onClick={() => wrap(t.previewRules, onPreviewRules)}>{t.previewRules}</button><button onClick={() => wrap(t.applyRules, onApplyRules)}>{t.applyRules}</button></div>
      <pre>{transformPlan ? JSON.stringify(transformPlan, null, 2) : 'Run preview to inspect rule decisions.'}</pre>
    </section>}

    {settings.showTerminal && <section className="panel terminal-panel"><h2>{t.terminal}</h2><div className="terminal-log" ref={terminalRef}>{logs.length === 0 ? <p className="subtle">{t.noLogs}</p> : logs.map((e) => <div key={e.id} className={`log-line ${e.level}`}><span className="log-time">[{fmt(e.timestamp)}]</span><span className="log-level">{e.level.toUpperCase()}</span><span>{e.message}</span></div>)}</div></section>}
    {nav}
    <section className="panel"><h3>Parsed Metadata</h3><pre>{JSON.stringify(metadata, null, 2)}</pre>{compatibilityReport && <p><strong>Score:</strong> {compatibilityReport.score} / 100</p>}</section>
  </div>;
}
