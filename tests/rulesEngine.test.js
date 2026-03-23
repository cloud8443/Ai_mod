const test = require('node:test');
const assert = require('node:assert/strict');

const { runDeterministicRuleTransform } = require('../dist-electron/src/lib/transform/rulesEngine.js');

test('rules engine selects/skips version-based same-loader rules', () => {
  const plan = runDeterministicRuleTransform({
    files: [
      {
        path: 'ExampleMod.java',
        content: 'BuiltinRegistries.X;\nnew ResourceLocation("a", "b");'
      }
    ],
    sourceLoader: 'forge',
    targetLoader: 'forge',
    sourceMinecraftVersion: '1.20.1',
    targetMinecraftVersion: '1.20.6',
    mode: 'preview',
    backup: { enabled: true, strategy: 'in-memory-manifest' }
  });

  const selected = plan.ruleDecisions.filter((d) => d.selected).map((d) => d.ruleId);
  const skipped = plan.ruleDecisions.filter((d) => !d.selected).map((d) => d.ruleId);

  assert.ok(selected.includes('mc-1-20-5-datapack-registry-rename'));
  assert.ok(skipped.includes('mc-1-21-resource-location-ctor'));
});

test('rules engine apply mode returns transformed output and decisions', () => {
  const plan = runDeterministicRuleTransform({
    files: [
      {
        path: 'ExampleMod.java',
        content: 'BuiltinRegistries.X;'
      }
    ],
    sourceLoader: 'forge',
    targetLoader: 'forge',
    sourceMinecraftVersion: '1.20.1',
    targetMinecraftVersion: '1.20.6',
    mode: 'apply',
    backup: { enabled: true, strategy: 'in-memory-manifest' }
  });

  assert.equal(plan.results[0].changed, true);
  assert.ok(plan.results[0].outputContent?.includes('BuiltInRegistries'));
  assert.ok(plan.ruleDecisions.length > 0);
});

test('rules engine throws for cross-loader transforms', () => {
  assert.throws(() =>
    runDeterministicRuleTransform({
      files: [{ path: 'x.java', content: 'class X {}' }],
      sourceLoader: 'forge',
      targetLoader: 'fabric',
      targetMinecraftVersion: '1.20.6',
      mode: 'preview',
      backup: { enabled: true, strategy: 'in-memory-manifest' }
    })
  );
});
