import type { ConversionRequest } from '../types/contracts';

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

  return [
    'You are an assistant helping plan Minecraft mod version upgrades, not executing edits automatically.',
    'Important scope: only same-loader upgrades are allowed (Forge->Forge, Fabric->Fabric).',
    `Source loader(s): ${sourceLoaders}`,
    `Target loader: ${request.target.loader}`,
    `Target Minecraft version: ${request.target.minecraftVersion}`,
    'Source metadata:',
    mods,
    `User goals: ${request.userGoals ?? 'No additional goals provided.'}`,
    'Return:',
    '1) Risk-ranked compatibility findings',
    '2) Required manual code/API refactor categories',
    '3) Suggested stepwise conversion plan',
    '4) Test checklist for runtime validation',
    '5) Unknowns/assumptions'
  ].join('\n');
}
