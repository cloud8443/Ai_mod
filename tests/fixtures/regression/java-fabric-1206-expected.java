package demo;

import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.core.registries.BuiltInRegistries;

public class ExampleMod {
  public void migrate() {
    ItemGroupEvents.builder();
    var id = new ResourceLocation("demo", "value");
    BuiltInRegistries.BLOCK.get(id);
  }
}
