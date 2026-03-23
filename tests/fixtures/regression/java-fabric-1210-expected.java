package demo;

import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.core.registries.BuiltinRegistries;

public class ExampleMod {
  public void migrate() {
    CreativeModeTab.builder();
    var id = ResourceLocation.fromNamespaceAndPath("demo", "value");
    BuiltinRegistries.BLOCK.get(id);
  }
}
