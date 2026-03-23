import { parse } from 'java-parser';
import type { ModLoader } from '../types/contracts';
import { matchesVersion } from '../knowledge/migrationKnowledge';
import {
  CLASS_RENAME_MAPPINGS,
  IMPORT_RENAME_MAPPINGS,
  METHOD_RENAME_MAPPINGS,
  type ClassRenameMapping,
  type ImportRenameMapping,
  type MappingScope,
  type MethodRenameMapping
} from './generatedMappings';

export interface JavaAstTransformRequest {
  content: string;
  sourceLoader: Exclude<ModLoader, 'unknown'>;
  targetLoader: Exclude<ModLoader, 'unknown'>;
  sourceMinecraftVersion?: string;
  targetMinecraftVersion: string;
}

export interface JavaAstTransformResult {
  content: string;
  changed: boolean;
  appliedMappingIds: string[];
  warnings: string[];
}

export function runJavaAstAwareTransform(req: JavaAstTransformRequest): JavaAstTransformResult {
  const warnings: string[] = [];

  if (!looksLikeJava(req.content)) {
    return { content: req.content, changed: false, appliedMappingIds: [], warnings };
  }

  if (!parseSafe(req.content)) {
    warnings.push('AST-aware transform skipped: source file did not parse as Java.');
    return { content: req.content, changed: false, appliedMappingIds: [], warnings };
  }

  let next = req.content;
  const appliedMappingIds: string[] = [];

  for (const mapping of IMPORT_RENAME_MAPPINGS) {
    if (!mappingMatches(mapping, req)) continue;
    const before = next;
    next = renameImport(next, mapping);
    if (next !== before) appliedMappingIds.push(mapping.id);
  }

  for (const mapping of CLASS_RENAME_MAPPINGS) {
    if (!mappingMatches(mapping, req)) continue;
    const before = next;
    next = renameClassIdentifier(next, mapping);
    if (next !== before) appliedMappingIds.push(mapping.id);
  }

  for (const mapping of METHOD_RENAME_MAPPINGS) {
    if (!mappingMatches(mapping, req)) continue;
    const before = next;
    next = renameMethodPattern(next, mapping);
    if (next !== before) appliedMappingIds.push(mapping.id);
  }

  if (next !== req.content && !parseSafe(next)) {
    warnings.push('AST-aware transform reverted: transformed output failed Java parse validation.');
    return { content: req.content, changed: false, appliedMappingIds: [], warnings };
  }

  return {
    content: next,
    changed: next !== req.content,
    appliedMappingIds,
    warnings
  };
}

function looksLikeJava(content: string): boolean {
  return /\b(class|interface|enum|import|package)\b/.test(content);
}

function parseSafe(content: string): boolean {
  try {
    parse(content);
    return true;
  } catch {
    return false;
  }
}

function mappingMatches(mapping: MappingScope, req: JavaAstTransformRequest): boolean {
  if (mapping.sourceLoader && mapping.sourceLoader !== req.sourceLoader) return false;
  if (mapping.targetLoader && mapping.targetLoader !== req.targetLoader) return false;
  if (mapping.sourceVersionRange && !matchesVersion(req.sourceMinecraftVersion, mapping.sourceVersionRange)) return false;
  if (mapping.targetVersionRange && !matchesVersion(req.targetMinecraftVersion, mapping.targetVersionRange)) return false;
  return true;
}

function renameImport(content: string, mapping: ImportRenameMapping): string {
  const escapedFrom = escapeRegExp(mapping.from);
  const re = new RegExp(`(^|\\n)\\s*import\\s+${escapedFrom}\\s*;`, 'g');
  return content.replace(re, (match) => match.replace(mapping.from, mapping.to));
}

function renameClassIdentifier(content: string, mapping: ClassRenameMapping): string {
  const re = new RegExp(`\\b${escapeRegExp(mapping.from)}\\b`, 'g');
  return content.replace(re, mapping.to);
}

function renameMethodPattern(content: string, mapping: MethodRenameMapping): string {
  if (mapping.from === 'new ResourceLocation' && mapping.to === 'ResourceLocation.fromNamespaceAndPath') {
    return content.replace(
      /new\s+ResourceLocation\(([^,]+),\s*([^)]+)\)/g,
      'ResourceLocation.fromNamespaceAndPath($1, $2)'
    );
  }

  if (mapping.className && mapping.from === mapping.className) {
    const re = new RegExp(`\\b${escapeRegExp(mapping.className)}\\.`, 'g');
    return content.replace(re, `${mapping.to}.`);
  }

  const fromRe = new RegExp(`\\b${escapeRegExp(mapping.from)}\\b`, 'g');
  return content.replace(fromRe, mapping.to);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
