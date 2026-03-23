import crypto from 'node:crypto';
import { getMatchedKnowledgeEntries, matchesVersion } from '../knowledge/migrationKnowledge';
import type { RuleSelectionDecision, RuleTransformPlan, RuleTransformRequest } from '../types/contracts';
import { runJavaAstAwareTransform } from './javaAstTransform';

type Rule = {
  id: string;
  description: string;
  confidence: number;
  sourceLoader?: 'forge' | 'fabric';
  targetLoader?: 'forge' | 'fabric';
  sourceVersionRange?: string;
  targetVersionRange?: string;
  transform: (content: string) => string;
};

const RULES: Rule[] = [

  {
    id: 'mc-1-20-5-datapack-registry-rename',
    description: 'Version hint: BuiltinRegistries -> BuiltInRegistries',
    confidence: 0.9,
    targetVersionRange: '>=1.20.5 <1.21.0',
    transform: (content) => content.replace(/BuiltinRegistries/g, 'BuiltInRegistries')
  },
  {
    id: 'mc-1-21-resource-location-ctor',
    description: 'Version hint: new ResourceLocation(ns, path) -> ResourceLocation.fromNamespaceAndPath',
    confidence: 0.92,
    targetVersionRange: '>=1.21.0',
    transform: (content) =>
      content.replace(
        /new\s+ResourceLocation\(([^,]+),\s*([^)]+)\)/g,
        'ResourceLocation.fromNamespaceAndPath($1, $2)'
      )
  }
];

export function runDeterministicRuleTransform(req: RuleTransformRequest): RuleTransformPlan {
  if (req.sourceLoader !== req.targetLoader) {
    throw new Error('Cross-loader rules transforms are disabled. Use the same source and target loader.');
  }

  const matchedKnowledgeEntries = getMatchedKnowledgeEntries({
    sourceLoader: req.sourceLoader,
    targetLoader: req.targetLoader,
    sourceVersion: req.sourceMinecraftVersion,
    targetVersion: req.targetMinecraftVersion
  });

  const ruleDecisions: RuleSelectionDecision[] = RULES.map((rule) => selectRule(rule, req));
  const applicableRules = RULES.filter((rule) => ruleDecisions.find((d) => d.ruleId === rule.id)?.selected);

  const deterministicRuleOrder = applicableRules.map((r) => r.id).sort();
  const orderedRules = deterministicRuleOrder
    .map((id) => applicableRules.find((r) => r.id === id))
    .filter((r): r is Rule => Boolean(r));

  let totalRuleApplications = 0;
  const astWarnings: string[] = [];

  const results = req.files.map((file) => {
    let next = file.content;
    const beforeHash = hash(file.content);
    const appliedRuleIds: string[] = [];

    const astResult = runJavaAstAwareTransform({
      content: next,
      sourceLoader: req.sourceLoader,
      targetLoader: req.targetLoader,
      sourceMinecraftVersion: req.sourceMinecraftVersion,
      targetMinecraftVersion: req.targetMinecraftVersion
    });

    if (astResult.warnings.length > 0) {
      astWarnings.push(`${file.path}: ${astResult.warnings.join(' | ')}`);
    }

    if (astResult.changed) {
      next = astResult.content;
      appliedRuleIds.push(...astResult.appliedMappingIds.map((id) => `ast:${id}`));
      totalRuleApplications += astResult.appliedMappingIds.length;
    }

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
    matchedKnowledgeEntryIds: matchedKnowledgeEntries.map((entry) => entry.id),
    ruleDecisions,
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
      'AST-aware Java transform scaffold is enabled with parser validation for conservative import/class/method rename mappings.',
      'Rules remain deterministic; broad semantic Java/Kotlin project-wide rewrites are not yet included.',
      ...astWarnings,
      'Always run preview and tests before applying changes to real projects.'
    ],
    results
  };
}

function selectRule(rule: Rule, req: RuleTransformRequest): RuleSelectionDecision {
  if (rule.sourceLoader && rule.sourceLoader !== req.sourceLoader) {
    return { ruleId: rule.id, selected: false, confidence: rule.confidence, reason: `source loader mismatch (${req.sourceLoader})` };
  }
  if (rule.targetLoader && rule.targetLoader !== req.targetLoader) {
    return { ruleId: rule.id, selected: false, confidence: rule.confidence, reason: `target loader mismatch (${req.targetLoader})` };
  }
  if (rule.sourceVersionRange && !matchesVersion(req.sourceMinecraftVersion, rule.sourceVersionRange)) {
    return { ruleId: rule.id, selected: false, confidence: rule.confidence, reason: `source version not in ${rule.sourceVersionRange}` };
  }
  if (rule.targetVersionRange && !matchesVersion(req.targetMinecraftVersion, rule.targetVersionRange)) {
    return { ruleId: rule.id, selected: false, confidence: rule.confidence, reason: `target version not in ${rule.targetVersionRange}` };
  }

  return {
    ruleId: rule.id,
    selected: true,
    confidence: rule.confidence,
    reason: `selected: ${rule.description}`
  };
}

function hash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function snippet(content: string): string {
  return content.split('\n').slice(0, 12).join('\n');
}
