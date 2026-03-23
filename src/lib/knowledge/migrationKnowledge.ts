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
    id: 'forge-to-fabric-1-16-1-20-common',
    title: 'Forge -> Fabric migration patterns (1.16-1.20)',
    sourceLoader: 'forge',
    targetLoader: 'fabric',
    sourceMinecraftRange: '>=1.16.0 <1.21.0',
    targetMinecraftRange: '>=1.16.0 <1.21.0',
    hints: [
      'Replace DeferredRegister/RegistryObject with Fabric registry setup.',
      'Port event hooks to Fabric API callbacks and mixins where needed.'
    ]
  },
  {
    id: 'fabric-to-forge-1-19-1-21',
    title: 'Fabric -> Forge migration patterns (1.19-1.21)',
    sourceLoader: 'fabric',
    targetLoader: 'forge',
    sourceMinecraftRange: '>=1.19.0 <=1.21.x',
    targetMinecraftRange: '>=1.19.0 <=1.21.x',
    hints: [
      'Replace Fabric callback/event API usage with Forge event bus subscriptions.',
      'Use DeferredRegister for content registration.'
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

export const LOADER_API_RENAMES: LoaderApiRename[] = [
  {
    id: 'creative-mode-tab-to-item-group-events',
    fromLoader: 'forge',
    toLoader: 'fabric',
    minecraftRange: '>=1.19.0',
    fromSymbol: 'CreativeModeTab',
    toSymbol: 'ItemGroupEvents',
    note: 'Fabric uses ItemGroupEvents callbacks in place of direct CreativeModeTab usage patterns.'
  },
  {
    id: 'registry-object-to-fabric-register',
    fromLoader: 'forge',
    toLoader: 'fabric',
    minecraftRange: '>=1.16.0',
    fromSymbol: 'RegistryObject<T>',
    toSymbol: 'Registry.register(...)',
    note: 'Forge deferred object handles map to direct registration calls in Fabric ecosystems.'
  },
  {
    id: 'fabric-registry-register-to-deferred-register',
    fromLoader: 'fabric',
    toLoader: 'forge',
    minecraftRange: '>=1.16.0',
    fromSymbol: 'Registry.register(...)',
    toSymbol: 'DeferredRegister',
    note: 'Forge registration is typically orchestrated via DeferredRegister and mod event bus.'
  }
];

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
