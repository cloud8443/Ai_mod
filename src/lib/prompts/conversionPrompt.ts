import type { ConversionRequest } from '../types/contracts';

const DEFAULT_INTERNAL_GOALS = '기존 동작과 호환성을 최대한 유지하면서 컴파일/런타임 오류를 우선 최소화하고, 위험 요소는 근거와 함께 단계별로 제시해 주세요.';

export function buildConversionPrompt(request: ConversionRequest): string {
  const mods = request.source
    .map(
      (m) =>
        `- ${m.modId} (${m.loader}) v${m.version ?? 'unknown'} | MC ranges: ${m.minecraftVersions.join(', ') || 'none'} | deps: ${
          m.dependencies.map((d) => `${d.id}:${d.versionRange ?? '?'}`).join(', ') || 'none'
        }`
    )
    .join('\n');

  const sourceLoaders = [...new Set(request.source.map((m) => m.loader))].join(', ') || 'unknown';
  const goals = request.userGoals?.trim() || DEFAULT_INTERNAL_GOALS;

  return [
    'You are a senior Minecraft mod migration planner. You produce actionable plans only (no automatic code execution).',
    '중요: 같은 로더 업그레이드만 허용됩니다. (Forge->Forge, Fabric->Fabric)',
    'Never propose cross-loader migration steps.',
    `Source loader(s): ${sourceLoaders}`,
    `Target loader: ${request.target.loader}`,
    `Target Minecraft version: ${request.target.minecraftVersion}`,
    '',
    '[Source metadata]',
    mods || '- none',
    '',
    '[Internal optimization goals]',
    goals,
    '',
    'Return in Korean unless user explicitly asks another language. Keep wording concise and practical.',
    'Output format:',
    '1) Risk-ranked compatibility findings (high -> medium -> low)',
    '2) Required code/API refactor categories with concrete examples',
    '3) Step-by-step migration plan (small safe batches)',
    '4) Validation checklist (build, startup, world-load, regression)',
    '5) Unknowns/assumptions and what to verify first'
  ].join('\n');
}
