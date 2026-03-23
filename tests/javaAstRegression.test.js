const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { runDeterministicRuleTransform } = require('../dist-electron/src/lib/transform/rulesEngine.js');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures/regression', name), 'utf8');

test('java regression fixture: forge->forge 1.20.6 applies BuiltInRegistries rename', () => {
  const plan = runDeterministicRuleTransform({
    files: [{ path: 'ExampleMod.java', content: fixture('java-forge-input.java') }],
    sourceLoader: 'forge',
    targetLoader: 'forge',
    sourceMinecraftVersion: '1.20.1',
    targetMinecraftVersion: '1.20.6',
    mode: 'apply',
    backup: { enabled: true, strategy: 'in-memory-manifest' }
  });

  assert.equal(plan.results[0].outputContent, fixture('java-fabric-1206-expected.java'));
});

test('java regression fixture: forge->forge 1.21.0 applies ResourceLocation static factory', () => {
  const plan = runDeterministicRuleTransform({
    files: [{ path: 'ExampleMod.java', content: fixture('java-forge-input.java') }],
    sourceLoader: 'forge',
    targetLoader: 'forge',
    sourceMinecraftVersion: '1.20.1',
    targetMinecraftVersion: '1.21.0',
    mode: 'apply',
    backup: { enabled: true, strategy: 'in-memory-manifest' }
  });

  assert.equal(plan.results[0].outputContent, fixture('java-fabric-1210-expected.java'));
  assert.ok(plan.results[0].outputContent.includes('ResourceLocation.fromNamespaceAndPath'));
});
