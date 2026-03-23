import { useEffect, useMemo, useRef, useState } from 'react';
import type { AIProvider, CompatibilityReport, ParsedModMetadata, RuleTransformPlan } from './lib/types/contracts';

type Loader = 'forge' | 'fabric';
type Lang = 'en' | 'ko';
type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

type LogEntry = { id: number; timestamp: number; level: LogLevel; message: string };

type UiSettings = {
  language: Lang;
  showTerminal: boolean;
  autoScrollTerminal: boolean;
  verboseLogging: boolean;
};

const DEFAULT_SETTINGS: UiSettings = { language: 'ko', showTerminal: false, autoScrollTerminal: true, verboseLogging: false };

const TEXT = {
  en: {
    appTitle: 'MC Mod Converter AI',
    appSubtitle: 'One-click helper for same-loader Minecraft mod version upgrades.',
    settings: 'Settings', close: 'Close', language: 'Language', showTerminal: 'Show terminal logs',
    verbose: 'Verbose logs',
    oneClickTitle: 'One-Click Mode (recommended)',
    oneClickDesc: 'Set versions, paste metadata/code, then click once. The app runs parse → compatibility check → prompt build → rules preview automatically.',
    sourceLoader: 'Current loader',
    targetVersion: 'Target Minecraft version (same loader only)',
    goals: 'What should be prioritized?',
    forgeMeta: 'Forge mods.toml (paste)',
    fabricMeta: 'Fabric fabric.mod.json (paste)',
    codeInput: 'Java code to preview rule changes',
    runOneClick: 'Run one-click conversion preview',
    running: 'Running...',
    blocked: 'Cross-loader conversion is disabled. Source and target loader must be the same.',
    resultSummary: 'Latest one-click result',
    analysis: 'Compatibility analysis',
    prompt: 'Generated prompt',
    rulesPreview: 'Rules preview result',
    authTitle: 'OpenAI login (optional if you paste token manually)',
    authDesc: 'If link login fails, paste an OpenAI API key or access token below and continue.',
    oauthClientId: 'OpenAI OAuth Client ID',
    redirectUri: 'Redirect URI',
    startAuth: 'Generate approval link',
    openLink: 'Open approval link',
    callbackInput: 'Paste callback URL or authorization code',
    completeAuth: 'Complete login',
    manualToken: 'Manual OpenAI API key / access token (recommended fallback)',
    saveCred: 'Save token', loadCred: 'Load saved token', clearCred: 'Clear token',
    oauthStatus: 'OAuth status',
    advancedMode: 'Advanced mode (optional)',
    parse: 'Only parse metadata', analyze: 'Only run compatibility check', buildPrompt: 'Only build prompt', plan: 'Generate AI plan text',
    previewRules: 'Only preview rules', applyRules: 'Apply rules to editor',
    terminal: 'Terminal', noLogs: 'No logs yet.'
  },
  ko: {
    appTitle: 'MC 모드 컨버터 AI',
    appSubtitle: '같은 로더 기준 버전 업그레이드를 버튼 한 번으로 도와드립니다.',
    settings: '설정', close: '닫기', language: '언어', showTerminal: '터미널 로그 보기',
    verbose: '상세 로그',
    oneClickTitle: '원클릭 모드 (기본/추천)',
    oneClickDesc: '버전 설정 후 메타데이터/코드를 붙여넣고 버튼 한 번만 누르세요. 파싱 → 호환성 분석 → 프롬프트 생성 → 규칙 미리보기를 자동으로 실행합니다.',
    sourceLoader: '현재 사용 중인 모드 로더',
    targetVersion: '목표 마인크래프트 버전 (같은 로더만 지원)',
    goals: '원하는 목표를 쉽게 적어주세요',
    forgeMeta: 'Forge mods.toml 붙여넣기',
    fabricMeta: 'Fabric fabric.mod.json 붙여넣기',
    codeInput: '규칙 미리보기에 사용할 Java 코드',
    runOneClick: '원클릭 변환 미리보기 실행',
    running: '실행 중...',
    blocked: '로더를 바꾸는 변환은 아직 지원하지 않습니다. 같은 로더(Forge→Forge 또는 Fabric→Fabric)로 진행해 주세요.',
    resultSummary: '최근 원클릭 실행 결과',
    analysis: '호환성 분석 결과',
    prompt: '생성된 프롬프트',
    rulesPreview: '규칙 미리보기 결과',
    authTitle: 'OpenAI 로그인 (수동 토큰 입력 시 생략 가능)',
    authDesc: '링크 로그인이 잘 안 되면 아래에 OpenAI API 키 또는 액세스 토큰을 붙여넣고 바로 진행하세요.',
    oauthClientId: 'OpenAI OAuth 클라이언트 ID',
    redirectUri: '리다이렉트 URI',
    startAuth: '승인 링크 만들기',
    openLink: '승인 링크 열기',
    callbackInput: '콜백 URL 또는 인증 코드 붙여넣기',
    completeAuth: '로그인 완료하기',
    manualToken: '수동 OpenAI API 키 / 액세스 토큰 (실패 시 가장 쉬운 방법)',
    saveCred: '토큰 저장', loadCred: '저장 토큰 불러오기', clearCred: '토큰 삭제',
    oauthStatus: 'OAuth 진행 상태',
    advancedMode: '고급 모드 (필요할 때만 펼치기)',
    parse: '메타데이터만 파싱', analyze: '호환성 분석만 실행', buildPrompt: '프롬프트만 생성', plan: 'AI 계획 텍스트 생성',
    previewRules: '규칙 미리보기만 실행', applyRules: '규칙을 코드에 적용',
    terminal: '터미널', noLogs: '아직 로그가 없습니다.'
  }
} as const;

const SAMPLE_FORGE = `[mods]\nmodLoader="javafml"\nloaderVersion="[47,)"\n\n[[mods]]\nmodId="sampleforge"\nversion="1.0.0"`;
const SAMPLE_FABRIC = `{"schemaVersion":1,"id":"samplefabric","version":"1.0.0"}`;
const SAMPLE_CODE = `import net.minecraft.resources.ResourceLocation;\nnew ResourceLocation("example", "thing");`;

const fmt = (t: number) => new Date(t).toLocaleTimeString();

function friendlyError(error: unknown, language: Lang): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (language === 'ko') {
    if (/client_id|client id|clientId/i.test(raw)) {
      return 'client_id가 비어 있습니다. OpenAI 플랫폼에서 발급한 OAuth Client ID를 입력하거나, 아래 수동 토큰 입력 칸에 API 키/액세스 토큰을 붙여넣어 바로 진행해 주세요.';
    }
    if (/token exchange failed|failed to fetch|network|ECONN|fetch/i.test(raw)) {
      return 'OpenAI 인증 서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요. 계속 실패하면 수동 토큰 입력 칸에 API 키/액세스 토큰을 붙여넣고 원클릭을 진행할 수 있습니다.';
    }
  }
  return raw;
}

export function App() {
  const [forgeToml, setForgeToml] = useState(SAMPLE_FORGE);
  const [fabricJson, setFabricJson] = useState(SAMPLE_FABRIC);
  const [metadata, setMetadata] = useState<ParsedModMetadata[]>([]);
  const [targetVersion, setTargetVersion] = useState('1.20.4');
  const [sourceLoader, setSourceLoader] = useState<Loader>('forge');
  const [provider] = useState<AIProvider>('openai');
  const [token, setToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('https://localhost/callback');
  const [authUrl, setAuthUrl] = useState('');
  const [codeOrUrl, setCodeOrUrl] = useState('');
  const [oauthLog, setOauthLog] = useState('');
  const [goals, setGoals] = useState('컴파일 오류를 먼저 줄이고, 기존 동작을 최대한 유지하고 싶습니다.');
  const [reportText, setReportText] = useState('');
  const [compatibilityReport, setCompatibilityReport] = useState<CompatibilityReport | null>(null);
  const [promptText, setPromptText] = useState('');
  const [planText, setPlanText] = useState('');
  const [codeInput, setCodeInput] = useState(SAMPLE_CODE);
  const [transformPlan, setTransformPlan] = useState<RuleTransformPlan | null>(null);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [runningOneClick, setRunningOneClick] = useState(false);
  const logIdRef = useRef(1);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const t = TEXT[settings.language];
  const targetLoader = sourceLoader;

  const request = useMemo(
    () => ({ source: metadata, target: { minecraftVersion: targetVersion, loader: targetLoader }, userGoals: goals }),
    [metadata, targetVersion, targetLoader, goals]
  );

  const pushLog = (level: LogLevel, message: string) => {
    if (level === 'debug' && !settings.verboseLogging) return;
    setLogs((cur) => [...cur, { id: logIdRef.current++, timestamp: Date.now(), level, message }]);
  };

  useEffect(() => {
    pushLog('info', settings.language === 'ko' ? '원클릭 모드가 기본으로 준비되었습니다.' : 'One-click mode is ready.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settings.showTerminal || !settings.autoScrollTerminal) return;
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs, settings.showTerminal, settings.autoScrollTerminal]);

  async function onParse() {
    const parsed = await window.mcModConverter.parseMetadata([
      { name: 'mods.toml', content: forgeToml },
      { name: 'fabric.mod.json', content: fabricJson }
    ]);
    setMetadata(parsed);
    pushLog('success', `Parsed ${parsed.length} metadata entries.`);
    return parsed;
  }

  async function onAnalyze(source: ParsedModMetadata[]) {
    const nextRequest = { ...request, source };
    const report = await window.mcModConverter.analyzeCompatibility(nextRequest);
    setCompatibilityReport(report);
    setReportText(JSON.stringify(report, null, 2));
    pushLog('success', `Compatibility score: ${report.score}/100`);
    return { report, nextRequest };
  }

  async function onStartAuth() {
    const flow = await window.mcModConverter.startOpenAILinkFlow({ clientId, redirectUri, openBrowser: false });
    setAuthUrl(flow.authorizationUrl);
    setOauthLog(settings.language === 'ko'
      ? '승인 링크가 생성되었습니다. 브라우저에서 승인 후 콜백 URL 또는 코드를 아래 칸에 붙여넣어 주세요.'
      : 'Approval link created. Open it, approve, and paste callback URL or code below.');
  }

  async function onCompleteAuth() {
    const tokenResult = await window.mcModConverter.completeOpenAILinkFlow({ clientId, codeOrCallbackUrl: codeOrUrl });
    setToken(tokenResult.access_token);
    await window.mcModConverter.setSecret('openai', tokenResult.access_token);
    setOauthLog(settings.language === 'ko'
      ? '로그인이 완료되어 토큰을 저장했습니다. 이제 원클릭을 실행할 수 있습니다.'
      : 'Login complete. Access token saved.');
  }

  async function onGeneratePlan(prompt: string) {
    const plan = await window.mcModConverter.generatePlan({ provider, credentials: { oauthAccessToken: token, apiKey: token }, prompt });
    setPlanText(plan);
    return plan;
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
    return plan;
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
    if (plan.results[0]?.outputContent) setCodeInput(plan.results[0].outputContent);
    setTransformPlan(plan);
  }

  async function runOneClick() {
    setRunningOneClick(true);
    setPlanText('');
    try {
      pushLog('info', settings.language === 'ko' ? '원클릭: 메타데이터 파싱 시작' : 'One-click: parsing metadata');
      const parsed = await onParse();

      pushLog('info', settings.language === 'ko' ? '원클릭: 호환성 분석 시작' : 'One-click: running compatibility analysis');
      const { nextRequest } = await onAnalyze(parsed);

      pushLog('info', settings.language === 'ko' ? '원클릭: 프롬프트 생성 시작' : 'One-click: building prompt');
      const prompt = await window.mcModConverter.buildPrompt(nextRequest);
      setPromptText(prompt);

      if (token.trim()) {
        pushLog('info', settings.language === 'ko' ? '원클릭: AI 계획 생성 시작' : 'One-click: generating AI plan');
        await onGeneratePlan(prompt);
      } else {
        pushLog(
          'warn',
          settings.language === 'ko'
            ? '토큰이 없어 AI 계획 생성은 건너뛰었습니다. 아래 수동 토큰 입력 후 다시 실행할 수 있습니다.'
            : 'Skipped AI plan generation (no token). Paste token and rerun anytime.'
        );
      }

      pushLog('info', settings.language === 'ko' ? '원클릭: 규칙 미리보기 시작' : 'One-click: previewing rules');
      await onPreviewRules();

      pushLog('success', settings.language === 'ko' ? '원클릭 실행이 완료되었습니다.' : 'One-click flow completed.');
    } catch (error) {
      const msg = friendlyError(error, settings.language);
      pushLog('error', msg);
    } finally {
      setRunningOneClick(false);
    }
  }

  async function wrap(name: string, fn: () => Promise<void>) {
    try {
      pushLog('info', name);
      await fn();
      pushLog('success', `${name} done.`);
    } catch (e) {
      pushLog('error', friendlyError(e, settings.language));
    }
  }

  return <div className="container">
    <div className="title-row"><div><h1>{t.appTitle}</h1><p className="subtle">{t.appSubtitle}</p></div><button onClick={() => setSettingsOpen(true)}>{t.settings}</button></div>

    {settingsOpen && <section className="panel settings-panel">
      <div className="settings-header"><h2>{t.settings}</h2><button onClick={() => setSettingsOpen(false)}>{t.close}</button></div>
      <label>{t.language}<select value={settings.language} onChange={(e) => setSettings((c) => ({ ...c, language: e.target.value as Lang }))}><option value="en">English</option><option value="ko">한국어</option></select></label>
      <label><input type="checkbox" checked={settings.showTerminal} onChange={(e) => setSettings((c) => ({ ...c, showTerminal: e.target.checked }))} /> {t.showTerminal}</label>
      <label><input type="checkbox" checked={settings.verboseLogging} onChange={(e) => setSettings((c) => ({ ...c, verboseLogging: e.target.checked }))} /> {t.verbose}</label>
    </section>}

    <section className="panel">
      <h2>{t.oneClickTitle}</h2>
      <p className="subtle">{t.oneClickDesc}</p>
      <div className="grid controls two-col">
        <label>{t.sourceLoader}<select value={sourceLoader} onChange={(e) => setSourceLoader(e.target.value as Loader)}><option value="forge">Forge</option><option value="fabric">Fabric</option></select></label>
        <label>{t.targetVersion}<input value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)} /></label>
      </div>
      <label>{t.goals}<textarea value={goals} onChange={(e) => setGoals(e.target.value)} /></label>
      <div className="grid two"><section><h3>{t.forgeMeta}</h3><textarea value={forgeToml} onChange={(e) => setForgeToml(e.target.value)} /></section><section><h3>{t.fabricMeta}</h3><textarea value={fabricJson} onChange={(e) => setFabricJson(e.target.value)} /></section></div>
      <label>{t.codeInput}<textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)} /></label>
      <div className="actions"><button className="primary" disabled={runningOneClick} onClick={() => void runOneClick()}>{runningOneClick ? t.running : t.runOneClick}</button></div>
    </section>

    <section className="panel">
      <h2>{t.authTitle}</h2>
      <p className="subtle">{t.authDesc}</p>
      <label>{t.manualToken}<input value={token} onChange={(e) => setToken(e.target.value)} placeholder="sk-... or oauth access token" /></label>
      <div className="actions compact">
        <button onClick={() => wrap(t.saveCred, async () => { if (token.trim()) await window.mcModConverter.setSecret('openai', token.trim()); })}>{t.saveCred}</button>
        <button onClick={() => wrap(t.loadCred, async () => { const s = await window.mcModConverter.getSecret('openai'); setToken(s?.value ?? ''); })}>{t.loadCred}</button>
        <button onClick={() => wrap(t.clearCred, async () => { await window.mcModConverter.clearSecret('openai'); setToken(''); })}>{t.clearCred}</button>
      </div>
      <div className="grid two">
        <label>{t.oauthClientId}<input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="oa-client-..." /></label>
        <label>{t.redirectUri}<input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} /></label>
      </div>
      <label>{t.callbackInput}<input value={codeOrUrl} onChange={(e) => setCodeOrUrl(e.target.value)} /></label>
      <div className="actions">
        <button onClick={() => wrap(t.startAuth, onStartAuth)}>{t.startAuth}</button>
        <button disabled={!authUrl} onClick={() => window.open(authUrl, '_blank')}>{t.openLink}</button>
        <button onClick={() => wrap(t.completeAuth, onCompleteAuth)}>{t.completeAuth}</button>
      </div>
      <pre>{oauthLog || (settings.language === 'ko' ? '여기에 OAuth 진행 상태가 표시됩니다.' : 'OAuth status will appear here.')}</pre>
    </section>

    <section className="panel">
      <h2>{t.resultSummary}</h2>
      <h3>{t.analysis}</h3>
      <pre>{reportText || (settings.language === 'ko' ? '원클릭 실행 후 분석 결과가 표시됩니다.' : 'Run one-click to view analysis.')}</pre>
      <h3>{t.prompt}</h3>
      <pre>{promptText || (settings.language === 'ko' ? '원클릭 실행 후 프롬프트가 표시됩니다.' : 'Run one-click to view prompt.')}</pre>
      <h3>AI Plan</h3>
      <pre>{planText || (settings.language === 'ko' ? '토큰 입력 시 AI 계획이 생성됩니다.' : 'AI plan appears when token is provided.')}</pre>
      <h3>{t.rulesPreview}</h3>
      <pre>{transformPlan ? JSON.stringify(transformPlan, null, 2) : (settings.language === 'ko' ? '원클릭 실행 후 규칙 미리보기가 표시됩니다.' : 'Run one-click to view rule preview.')}</pre>
      {compatibilityReport && <p><strong>Score:</strong> {compatibilityReport.score} / 100</p>}
    </section>

    <details className="panel">
      <summary><strong>{t.advancedMode}</strong></summary>
      <div className="actions">
        <button onClick={() => wrap(t.parse, async () => { await onParse(); })}>{t.parse}</button>
        <button onClick={() => wrap(t.analyze, async () => { const parsed = metadata.length > 0 ? metadata : await onParse(); await onAnalyze(parsed); })}>{t.analyze}</button>
        <button onClick={() => wrap(t.buildPrompt, async () => { const nextRequest = { ...request, source: metadata.length > 0 ? metadata : await onParse() }; const p = await window.mcModConverter.buildPrompt(nextRequest); setPromptText(p); })}>{t.buildPrompt}</button>
        <button disabled={!token.trim()} onClick={() => wrap(t.plan, async () => { const base = promptText || await window.mcModConverter.buildPrompt({ ...request, source: metadata.length > 0 ? metadata : await onParse() }); await onGeneratePlan(base); })}>{t.plan}</button>
        <button onClick={() => wrap(t.previewRules, async () => { await onPreviewRules(); })}>{t.previewRules}</button>
        <button onClick={() => wrap(t.applyRules, onApplyRules)}>{t.applyRules}</button>
      </div>
    </details>

    {settings.showTerminal && <section className="panel terminal-panel"><h2>{t.terminal}</h2><div className="terminal-log" ref={terminalRef}>{logs.length === 0 ? <p className="subtle">{t.noLogs}</p> : logs.map((e) => <div key={e.id} className={`log-line ${e.level}`}><span className="log-time">[{fmt(e.timestamp)}]</span><span className="log-level">{e.level.toUpperCase()}</span><span>{e.message}</span></div>)}</div></section>}
  </div>;
}
