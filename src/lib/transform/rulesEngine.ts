import crypto from 'node:crypto';
import type { RuleTransformPlan, RuleTransformRequest } from '../types/contracts';

type Rule = {
  id: string;
  description: string;
  when: (req: RuleTransformRequest) => boolean;
  transform: (content: string) => string;
};

const RULES: Rule[] = [
  {
    id: 'forge-to-fabric-import-itemgroup',
    description: 'Forge CreativeModeTab -> Fabric ItemGroup import migration',
    when: (req) => req.sourceLoader === 'forge' && req.targetLoader === 'fabric',
    transform: (content) =>
      content
        .replace(/import\s+net\.minecraft\.world\.item\.CreativeModeTab;/g, 'import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;')
        .replace(/CreativeModeTab\./g, 'ItemGroupEvents.')
  },
  {
    id: 'forge-to-fabric-registryobject',
    description: 'Forge RegistryObject usage to direct registry access placeholder',
    when: (req) => req.sourceLoader === 'forge' && req.targetLoader === 'fabric',
    transform: (content) =>
      content
        .replace(/import\s+net\.minecraftforge\.registries\.RegistryObject;/g, '')
        .replace(/RegistryObject<([^>]+)>\s+(\w+)\s*=\s*[^;]+;/g, '$1 $2 /* TODO: replace with Fabric Registry.register */;')
  },
  {
    id: 'fabric-to-forge-registry-register',
    description: 'Fabric Registry.register hints converted for Forge DeferredRegister',
    when: (req) => req.sourceLoader === 'fabric' && req.targetLoader === 'forge',
    transform: (content) =>
      content.replace(
        /Registry\.register\(([^;]+)\);/g,
        '/* TODO forge */ DeferredRegister flow required for: Registry.register($1);'
      )
  },
  {
    id: 'mc-1-20-5-datapack-registry-rename',
    description: 'Version hint: BuiltinRegistries -> BuiltInRegistries',
    when: (req) => req.targetMinecraftVersion.startsWith('1.20.5') || req.targetMinecraftVersion.startsWith('1.20.6'),
    transform: (content) => content.replace(/BuiltinRegistries/g, 'BuiltInRegistries')
  },
  {
    id: 'mc-1-21-resource-location-ctor',
    description: 'Version hint: new ResourceLocation(ns, path) -> ResourceLocation.fromNamespaceAndPath',
    when: (req) => req.targetMinecraftVersion.startsWith('1.21'),
    transform: (content) =>
      content.replace(
        /new\s+ResourceLocation\(([^,]+),\s*([^)]+)\)/g,
        'ResourceLocation.fromNamespaceAndPath($1, $2)'
      )
  }
];

export function runDeterministicRuleTransform(req: RuleTransformRequest): RuleTransformPlan {
  const applicableRules = RULES.filter((rule) => rule.when(req));
  const deterministicRuleOrder = applicableRules.map((r) => r.id).sort();
  const orderedRules = deterministicRuleOrder
    .map((id) => applicableRules.find((r) => r.id === id))
    .filter((r): r is Rule => Boolean(r));

  let totalRuleApplications = 0;

  const results = req.files.map((file) => {
    let next = file.content;
    const beforeHash = hash(file.content);
    const appliedRuleIds: string[] = [];

    for (const rule of orderedRules) {
      const transformed = rule.transform(next);
      if (transformed !== next) {
        next = transformed;
        appliedRuleIds.push(rule.id);
        totalRuleApplications += 1;
      }
    }

    const changed = next !== file.content;
    return {
      path: file.path,
      changed,
      appliedRuleIds,
      beforeHash,
      afterHash: hash(next),
      preview: {
        beforeSnippet: snippet(file.content),
        afterSnippet: snippet(next)
      },
      outputContent: req.mode === 'apply' && changed ? next : undefined
    };
  });

  const filesChanged = results.filter((r) => r.changed).length;
  const manifestId = `manifest-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  return {
    mode: req.mode,
    deterministicRuleOrder,
    backupPlan: {
      enabled: req.backup.enabled,
      strategy: req.backup.strategy,
      manifestId,
      rollbackInstructions: [
        'Use backup manifest hashes to validate rollback targets.',
        req.backup.strategy === 'filesystem-copy'
          ? 'Restore .mcmod-backups/<manifest-id> files over working tree.'
          : 'Reapply original in-memory content captured in preview/apply response before writing files.',
        'Re-run preview mode to ensure no residual modifications remain.'
      ]
    },
    summary: {
      filesScanned: req.files.length,
      filesChanged,
      totalRuleApplications
    },
    warnings: [
      'Rules are deterministic and regex-based; semantic Java/Kotlin AST rewrites are not included.',
      'Always run preview and tests before applying changes to real projects.'
    ],
    results
  };
}

function hash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function snippet(content: string): string {
  return content.split('\n').slice(0, 12).join('\n');
}
