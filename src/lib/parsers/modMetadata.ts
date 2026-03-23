import type { ParsedModMetadata } from '../types/contracts';

export function parseModMetadataFromFiles(files: { name: string; content: string }[]): ParsedModMetadata[] {
  return files
    .map((file) => {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('mods.toml')) return parseForgeModsToml(file.name, file.content);
      if (lowerName.endsWith('fabric.mod.json')) return parseFabricModJson(file.name, file.content);
      if (lowerName.endsWith('mcmod.info')) return parseMcmodInfo(file.name, file.content);
      return null;
    })
    .filter((v): v is ParsedModMetadata => v !== null);
}

function parseForgeModsToml(sourceFile: string, content: string): ParsedModMetadata {
  const modId = capture(content, /^modId\s*=\s*"([^"]+)"/m) ?? 'unknown-mod';
  const modName = capture(content, /^displayName\s*=\s*"([^"]+)"/m) ?? modId;
  const version = capture(content, /^version\s*=\s*"([^"]+)"/m);

  const minecraftRanges = Array.from(content.matchAll(/modId\s*=\s*"minecraft"[\s\S]*?versionRange\s*=\s*"([^"]+)"/g)).map(
    (m) => m[1]
  );

  const dependencies = Array.from(content.matchAll(/\[\[dependencies\.[^\]]+\]\]([\s\S]*?)(?=\n\[\[|$)/g)).map((m) => {
    const block = m[1];
    return {
      id: capture(block, /^modId\s*=\s*"([^"]+)"/m) ?? 'unknown-dep',
      versionRange: capture(block, /^versionRange\s*=\s*"([^"]+)"/m),
      required: (capture(block, /^mandatory\s*=\s*(true|false)/m) ?? 'true') === 'true'
    };
  });

  return {
    loader: 'forge',
    modId,
    modName,
    version,
    minecraftVersions: minecraftRanges,
    dependencies,
    sourceFile
  };
}

function parseFabricModJson(sourceFile: string, content: string): ParsedModMetadata {
  const json = JSON.parse(content) as Record<string, unknown>;
  const depends = (json.depends as Record<string, string> | undefined) ?? {};

  return {
    loader: 'fabric',
    modId: (json.id as string) ?? 'unknown-mod',
    modName: (json.name as string) ?? (json.id as string),
    version: json.version as string | undefined,
    minecraftVersions: depends.minecraft ? [depends.minecraft] : [],
    dependencies: Object.entries(depends)
      .filter(([id]) => id !== 'minecraft')
      .map(([id, versionRange]) => ({ id, versionRange, required: true })),
    sourceFile
  };
}

function parseMcmodInfo(sourceFile: string, content: string): ParsedModMetadata {
  const raw = JSON.parse(content) as Array<Record<string, unknown>>;
  const first = raw[0] ?? {};

  return {
    loader: 'forge',
    modId: (first.modid as string) ?? 'unknown-mod',
    modName: first.name as string | undefined,
    version: first.version as string | undefined,
    minecraftVersions: first.mcversion ? [first.mcversion as string] : [],
    dependencies: [],
    sourceFile
  };
}

function capture(content: string, regex: RegExp): string | undefined {
  return content.match(regex)?.[1];
}
