const test = require('node:test');
const assert = require('node:assert/strict');

const { runDeterministicRuleTransform } = require('../dist-electron/src/lib/transform/rulesEngine.js');

test('rules engine selects/skips rules by loader and target version', () => {
  const plan = runDeterministicRuleTransform({
    files: [
      {
        path: 'ExampleMod.java',
        content: 'import net.minecraft.world.item.CreativeModeTab;\nnew ResourceLocation("a", "b");'
      }
    ],
    sourceLoader: 'forge',
    targetLoader: 'fabric',
    sourceMinecraftVersion: '1.20.1',
    targetMinecraftVersion: '1.20.6',
    mode: 'preview',
    backup: { enabled: true, strategy: 'in-memory-manifest' }
  });

  const selected = plan.ruleDecisions.filter((d) => d.selected).map((d) => d.ruleId);
  const skipped = plan.ruleDecisions.filter((d) => !d.selected).map((d) => d.ruleId);

  assert.ok(selected.includes('forge-to-fabric-import-itemgroup'));
  assert.ok(selected.includes('mc-1-20-5-datapack-registry-rename'));
  assert.ok(skipped.includes('mc-1-21-resource-location-ctor'));
});

test('rules engine apply mode returns transformed output and decisions', () => {
  const plan = runDeterministicRuleTransform({
    files: [
      {
        path: 'ExampleMod.java',
        content: 'import net.minecraft.world.item.CreativeModeTab;'
      }
    ],
    sourceLoader: 'forge',
    targetLoader: 'fabric',
    sourceMinecraftVersion: '1.20.1',
    targetMinecraftVersion: '1.20.6',
    mode: 'apply',
    backup: { enabled: true, strategy: 'in-memory-manifest' }
  });

  assert.equal(plan.results[0].changed, true);
  assert.ok(plan.results[0].outputContent?.includes('ItemGroupEvents'));
  assert.ok(plan.ruleDecisions.length > 0);
});
