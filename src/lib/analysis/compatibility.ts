import semver from 'semver';
import {
  getMatchedKnowledgeEntries,
  LOADER_API_RENAMES,
  matchesVersion,
  normalizeRange
} from '../knowledge/migrationKnowledge';
import type { CompatibilityFactor, CompatibilityIssue, CompatibilityReport, ParsedModMetadata } from '../types/contracts';

export function analyzeCompatibility(
  source: ParsedModMetadata[],
  target: { minecraftVersion: string; loader: 'forge' | 'fabric' }
): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];
  const confidenceFactors: CompatibilityFactor[] = [];

  const targetVersion = semver.coerce(target.minecraftVersion)?.version ?? target.minecraftVersion;
  const primarySourceLoader = inferPrimaryLoader(source);
  const matchedKnowledge = getMatchedKnowledgeEntries({
    sourceLoader: primarySourceLoader,
    targetLoader: target.loader,
    sourceVersion: source[0]?.minecraftVersions[0],
    targetVersion
  });

  if (matchedKnowledge.length > 0) {
    confidenceFactors.push({
      label: 'knowledge-match',
      impact: 0.1,
      detail: `${matchedKnowledge.length} migration knowledge entries matched this conversion scenario.`
    });
  }

  const modsById = new Map(source.map((mod) => [mod.modId, mod]));

  for (const mod of source) {
    if (mod.loader !== target.loader) {
      issues.push({
        severity: 'warn',
        code: 'LOADER_MISMATCH',
        modId: mod.modId,
        message: `${mod.modId} is ${mod.loader}, target loader is ${target.loader}. Cross-loader conversion is typically manual.`
      });
      confidenceFactors.push({
        label: 'cross-loader-conversion',
        impact: -0.12,
        detail: `${mod.modId} requires API and lifecycle migration across loaders.`
      });
    }

    if (mod.minecraftVersions.length > 0) {
      const supportsTarget = mod.minecraftVersions.some((range) => isCompatibleWithRange(targetVersion, range));
      if (!supportsTarget) {
        issues.push({
          severity: 'warn',
          code: 'MC_VERSION_UNSUPPORTED',
          modId: mod.modId,
          message: `${mod.modId} metadata does not indicate compatibility with Minecraft ${target.minecraftVersion}.`
        });
        confidenceFactors.push({
          label: 'target-version-outside-range',
          impact: -0.08,
          detail: `${mod.modId} declares ranges ${mod.minecraftVersions.join(', ') || 'none'} which do not include ${target.minecraftVersion}.`
        });
      }
    } else {
      issues.push({
        severity: 'info',
        code: 'MC_VERSION_UNKNOWN',
        modId: mod.modId,
        message: `${mod.modId} has no explicit Minecraft version range in parsed metadata.`
      });
      confidenceFactors.push({
        label: 'missing-version-range',
        impact: -0.04,
        detail: `${mod.modId} does not expose explicit minecraft dependency version metadata.`
      });
    }

    for (const dep of mod.dependencies) {
      if (dep.required && !dep.versionRange) {
        issues.push({
          severity: 'info',
          code: 'DEP_VERSION_UNKNOWN',
          modId: mod.modId,
          message: `${mod.modId} requires dependency ${dep.id} without a parsed version constraint.`
        });
      }

      const dependencyMod = modsById.get(dep.id);
      if (dep.required && !dependencyMod && !isPlatformDependency(dep.id)) {
        issues.push({
          severity: 'warn',
          code: 'DEP_MISSING',
          modId: mod.modId,
          message: `${mod.modId} requires ${dep.id}, but it was not found in provided metadata set.`
        });
        confidenceFactors.push({
          label: 'missing-required-dependency',
          impact: -0.1,
          detail: `${mod.modId} depends on ${dep.id}, which may block startup unless supplied.`
        });
      }

      if (dependencyMod && dep.versionRange && dependencyMod.version) {
        const depOk = isCompatibleWithRange(dependencyMod.version, dep.versionRange);
        if (!depOk) {
          issues.push({
            severity: 'warn',
            code: 'DEP_VERSION_CONFLICT',
            modId: mod.modId,
            message: `${mod.modId} expects ${dep.id} ${dep.versionRange}, but detected ${dependencyMod.version}.`
          });
          confidenceFactors.push({
            label: 'dependency-version-conflict',
            impact: -0.14,
            detail: `${mod.modId} has an unsatisfied requirement against ${dep.id}.`
          });
        }
      }
    }
  }

  const loaderRenames = LOADER_API_RENAMES.filter(
    (rename) =>
      rename.fromLoader === primarySourceLoader &&
      rename.toLoader === target.loader &&
      matchesVersion(targetVersion, rename.minecraftRange)
  );

  if (loaderRenames.length > 0) {
    confidenceFactors.push({
      label: 'known-api-renames',
      impact: 0.06,
      detail: `${loaderRenames.length} known loader API rename mappings can guide deterministic migration.`
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const score = Math.max(0, 100 - errorCount * 40 - warnCount * 15);

  const confidence = clamp(
    0.55 +
      confidenceFactors.reduce((acc, factor) => acc + factor.impact, 0) -
      errorCount * 0.2 -
      warnCount * 0.06,
    0.05,
    0.99
  );

  return {
    score,
    confidence,
    summary:
      warnCount === 0
        ? 'No obvious metadata-level blockers found. Manual source/API changes may still be required.'
        : `${warnCount} potential compatibility warnings detected. Expect manual refactoring and testing.`,
    issues,
    matchedKnowledgeEntryIds: matchedKnowledge.map((entry) => entry.id),
    confidenceFactors
  };
}

function inferPrimaryLoader(mods: ParsedModMetadata[]): 'forge' | 'fabric' {
  const fabricCount = mods.filter((m) => m.loader === 'fabric').length;
  return fabricCount > mods.length / 2 ? 'fabric' : 'forge';
}

function isCompatibleWithRange(version: string, range: string): boolean {
  const coerced = semver.coerce(version);
  if (!coerced) return false;

  const normalized = normalizeRange(range);
  if (!normalized) return false;

  return semver.satisfies(coerced, normalized, { includePrerelease: true, loose: true });
}

function isPlatformDependency(depId: string): boolean {
  return ['minecraft', 'fabricloader', 'forge', 'java'].includes(depId.toLowerCase());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
