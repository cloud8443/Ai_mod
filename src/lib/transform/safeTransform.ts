import type { ConversionRequest, SafeTransformResult } from '../types/contracts';

/**
 * Explicitly non-destructive MVP stub.
 * Does not modify files. Produces planned actions only.
 */
export async function safeTransformStub(request: ConversionRequest): Promise<SafeTransformResult> {
  if (request.source.length === 0) {
    return {
      status: 'blocked',
      actions: [],
      warnings: ['No parsed mods found. Import metadata files first.']
    };
  }

  const actions = request.source.map(
    (mod) =>
      `Plan only: review ${mod.modId} for ${mod.loader} -> ${request.target.loader} migration to MC ${request.target.minecraftVersion}.`
  );

  return {
    status: 'planned',
    actions,
    warnings: [
      'Automatic source rewrite is intentionally disabled in MVP.',
      'Run transformations manually with backups and project-specific tests.'
    ]
  };
}
