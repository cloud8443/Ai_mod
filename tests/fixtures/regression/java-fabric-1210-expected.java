package demo;

import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.core.registries.BuiltinRegistries;

public class ExampleMod {
  public void migrate() {
    ItemGroupEvents.builder();
    var id = ResourceLocation.fromNamespaceAndPath("demo", "value");
    BuiltinRegistries.BLOCK.get(id);
  }
}
