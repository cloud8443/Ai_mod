package demo;

import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.core.registries.BuiltInRegistries;

public class ExampleMod {
  public void migrate() {
    CreativeModeTab.builder();
    var id = new ResourceLocation("demo", "value");
    BuiltInRegistries.BLOCK.get(id);
  }
}
