import semver from 'semver';
import type { CompatibilityIssue, CompatibilityReport, ParsedModMetadata } from '../types/contracts';

export function analyzeCompatibility(
  source: ParsedModMetadata[],
  target: { minecraftVersion: string; loader: 'forge' | 'fabric' }
): CompatibilityReport {
  const issues: CompatibilityIssue[] = [];

  for (const mod of source) {
    if (mod.loader !== target.loader) {
      issues.push({
        severity: 'warn',
        code: 'LOADER_MISMATCH',
        modId: mod.modId,
        message: `${mod.modId} is ${mod.loader}, target loader is ${target.loader}. Cross-loader conversion is typically manual.`
      });
    }

    if (mod.minecraftVersions.length > 0) {
      const supportsTarget = mod.minecraftVersions.some((range) => isLikelyCompatible(target.minecraftVersion, range));
      if (!supportsTarget) {
        issues.push({
          severity: 'warn',
          code: 'MC_VERSION_UNSUPPORTED',
          modId: mod.modId,
          message: `${mod.modId} metadata does not indicate compatibility with Minecraft ${target.minecraftVersion}.`
        });
      }
    } else {
      issues.push({
        severity: 'info',
        code: 'MC_VERSION_UNKNOWN',
        modId: mod.modId,
        message: `${mod.modId} has no explicit Minecraft version range in parsed metadata.`
      });
    }

    const riskyDeps = mod.dependencies.filter((d) => d.required && !d.versionRange);
    for (const dep of riskyDeps) {
      issues.push({
        severity: 'info',
        code: 'DEP_VERSION_UNKNOWN',
        modId: mod.modId,
        message: `${mod.modId} requires dependency ${dep.id} without a parsed version constraint.`
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const score = Math.max(0, 100 - errorCount * 40 - warnCount * 15);

  return {
    score,
    summary:
      warnCount === 0
        ? 'No obvious metadata-level blockers found. Manual source/API changes may still be required.'
        : `${warnCount} potential compatibility warnings detected. Expect manual refactoring and testing.`,
    issues
  };
}

function isLikelyCompatible(targetVersion: string, range: string): boolean {
  if (range.includes('[') || range.includes('(')) {
    const normalized = mavenRangeToSemver(range);
    if (normalized) {
      return semver.satisfies(semver.coerce(targetVersion) ?? targetVersion, normalized, { includePrerelease: true });
    }
  }

  const coerced = semver.coerce(targetVersion);
  const coercedRange = semver.coerce(range);
  if (coerced && coercedRange) {
    return coerced.version.startsWith(coercedRange.version.split('.').slice(0, 2).join('.'));
  }

  return range.includes(targetVersion);
}

function mavenRangeToSemver(mavenRange: string): string | null {
  const match = mavenRange.match(/^([\[(])([^,]*),([^\])]*)([\])])$/);
  if (!match) return null;

  const [, startIncl, start, end, endIncl] = match;
  const clauses: string[] = [];

  if (start.trim()) {
    const v = semver.coerce(start.trim())?.version;
    if (v) clauses.push(`${startIncl === '[' ? '>=' : '>'}${v}`);
  }

  if (end.trim()) {
    const v = semver.coerce(end.trim())?.version;
    if (v) clauses.push(`${endIncl === ']' ? '<=' : '<'}${v}`);
  }

  return clauses.length ? clauses.join(' ') : null;
}
