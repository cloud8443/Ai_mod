import semver from 'semver';

export type KnowledgeEntry = {
  id: string;
  title: string;
  sourceLoader?: 'forge' | 'fabric';
  targetLoader?: 'forge' | 'fabric';
  sourceMinecraftRange?: string;
  targetMinecraftRange?: string;
  hints: string[];
};

export type LoaderApiRename = {
  id: string;
  fromLoader: 'forge' | 'fabric';
  toLoader: 'forge' | 'fabric';
  minecraftRange?: string;
  fromSymbol: string;
  toSymbol: string;
  note: string;
};

export const MIGRATION_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'forge-1-12-to-modern-registry-events',
    title: 'Forge 1.12.x to 1.16+ registry/event modernization',
    sourceLoader: 'forge',
    targetLoader: 'forge',
    sourceMinecraftRange: '>=1.12.0 <1.13.0',
    targetMinecraftRange: '>=1.16.0',
    hints: [
      'Pre-1.13 numeric IDs and legacy registries need full rewrite to modern registry APIs.',
      'Lifecycle and event bus wiring changed significantly after flattening.'
    ]
  },
  {
    id: 'forge-1-16-to-1-21-modernization',
    title: 'Forge same-loader migration patterns (1.16-1.21)',
    sourceLoader: 'forge',
    targetLoader: 'forge',
    sourceMinecraftRange: '>=1.16.0 <1.22.0',
    targetMinecraftRange: '>=1.16.0 <1.22.0',
    hints: [
      'Review Forge event/lifecycle API updates and renamed registries across versions.',
      'DeferredRegister usage is still expected, but method signatures can drift between minor lines.'
    ]
  },
  {
    id: 'fabric-1-19-to-1-21-modernization',
    title: 'Fabric same-loader migration patterns (1.19-1.21)',
    sourceLoader: 'fabric',
    targetLoader: 'fabric',
    sourceMinecraftRange: '>=1.19.0 <1.22.0',
    targetMinecraftRange: '>=1.19.0 <1.22.0',
    hints: [
      'Check Fabric API module versions and moved callback/event APIs.',
      'Confirm loader and mapping compatibility for the exact target Minecraft version.'
    ]
  },
  {
    id: 'mc-1-20-5-registry-rename',
    title: 'MC 1.20.5+ BuiltInRegistries rename transition',
    targetMinecraftRange: '>=1.20.5 <1.21.0',
    hints: ['BuiltinRegistries references often need to become BuiltInRegistries.']
  },
  {
    id: 'mc-1-21-resource-location-factory',
    title: 'MC 1.21 ResourceLocation factory migration',
    targetMinecraftRange: '>=1.21.0',
    hints: ['new ResourceLocation(ns, path) should migrate to ResourceLocation.fromNamespaceAndPath(ns, path).']
  }
];

export const LOADER_API_RENAMES: LoaderApiRename[] = [];

export function matchesVersion(version: string | undefined, range: string | undefined): boolean {
  if (!range) return true;
  if (!version) return false;

  const coerced = semver.coerce(version);
  if (!coerced) return false;
  const normalized = normalizeRange(range);
  if (!normalized) return false;
  return semver.satisfies(coerced, normalized, { includePrerelease: true, loose: true });
}

export function normalizeRange(range: string): string | null {
  const trimmed = range.trim();
  if (!trimmed) return null;

  const mavenMatch = trimmed.match(/^([\[(])([^,]*),([^\])]*)([\])])$/);
  if (mavenMatch) {
    const [, startIncl, startRaw, endRaw, endIncl] = mavenMatch;
    const clauses: string[] = [];
    const start = semver.coerce(startRaw.trim())?.version;
    const end = semver.coerce(endRaw.trim())?.version;
    if (start) clauses.push(`${startIncl === '[' ? '>=' : '>'}${start}`);
    if (end) clauses.push(`${endIncl === ']' ? '<=' : '<'}${end}`);
    return clauses.length ? clauses.join(' ') : null;
  }

  if (/^\d+\.x$/i.test(trimmed)) {
    const [major] = trimmed.split('.');
    return `>=${major}.0.0 <${Number(major) + 1}.0.0`;
  }

  const direct = semver.validRange(trimmed, { loose: true });
  if (direct) return direct;

  const coerced = semver.coerce(trimmed)?.version;
  if (coerced) return `=${coerced}`;

  return null;
}

export function getMatchedKnowledgeEntries(params: {
  sourceLoader: 'forge' | 'fabric';
  targetLoader: 'forge' | 'fabric';
  sourceVersion?: string;
  targetVersion: string;
}): KnowledgeEntry[] {
  return MIGRATION_KNOWLEDGE.filter((entry) => {
    if (entry.sourceLoader && entry.sourceLoader !== params.sourceLoader) return false;
    if (entry.targetLoader && entry.targetLoader !== params.targetLoader) return false;
    if (!matchesVersion(params.sourceVersion, entry.sourceMinecraftRange)) return false;
    if (!matchesVersion(params.targetVersion, entry.targetMinecraftRange)) return false;
    return true;
  });
}
