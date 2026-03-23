const test = require('node:test');
const assert = require('node:assert/strict');

const { analyzeCompatibility } = require('../dist-electron/src/lib/analysis/compatibility.js');

test('analyzeCompatibility detects semver incompatibility and dependency conflicts with confidence factors', () => {
  const source = [
    {
      loader: 'forge',
      modId: 'coremod',
      version: '1.0.0',
      minecraftVersions: ['[1.20,1.20.2)'],
      dependencies: [{ id: 'helpermod', versionRange: '>=2.0.0', required: true }],
      sourceFile: 'mods.toml'
    },
    {
      loader: 'forge',
      modId: 'helpermod',
      version: '1.5.0',
      minecraftVersions: ['[1.20,1.21)'],
      dependencies: [],
      sourceFile: 'mods.toml'
    }
  ];

  const report = analyzeCompatibility(source, { minecraftVersion: '1.20.4', loader: 'forge' });

  assert.ok(report.issues.some((i) => i.code === 'MC_VERSION_UNSUPPORTED'));
  assert.ok(report.issues.some((i) => i.code === 'DEP_VERSION_CONFLICT'));
  assert.ok(report.confidence < 0.8);
  assert.ok(report.confidenceFactors.length > 0);
});

test('analyzeCompatibility blocks cross-loader requests', () => {
  const source = [
    {
      loader: 'forge',
      modId: 'portme',
      version: '1.0.0',
      minecraftVersions: ['[1.20,1.21)'],
      dependencies: [],
      sourceFile: 'mods.toml'
    }
  ];

  const report = analyzeCompatibility(source, { minecraftVersion: '1.20.6', loader: 'fabric' });

  assert.ok(report.issues.some((i) => i.code === 'LOADER_MISMATCH_UNSUPPORTED'));
  assert.ok(report.summary.toLowerCase().includes('blocked'));
});

test('analyzeCompatibility includes matched knowledge entries for forge same-loader migration', () => {
  const source = [
    {
      loader: 'forge',
      modId: 'portme',
      version: '1.0.0',
      minecraftVersions: ['[1.20,1.21)'],
      dependencies: [],
      sourceFile: 'mods.toml'
    }
  ];

  const report = analyzeCompatibility(source, { minecraftVersion: '1.20.6', loader: 'forge' });

  assert.ok(report.matchedKnowledgeEntryIds.length > 0);
});
