import { describe, expect, it } from "vitest";
import { NUMBERDROID_PROP_ART_REGISTRY } from "./propArtRegistry";
import { NUMBERDROID_PROP_REGISTRY } from "./propRegistry";

describe("Level Compiler v0.13 Prop art registry", () => {
  it("maps only spatially registered Props and keeps art review status explicit", () => {
    for (const registration of Object.values(NUMBERDROID_PROP_ART_REGISTRY)) {
      expect(NUMBERDROID_PROP_REGISTRY[registration.propId]).toBeDefined();
      expect(["accepted", "candidate"]).toContain(registration.status);
      expect(registration.asset).toMatch(/^assets\//);
    }

    expect(NUMBERDROID_PROP_ART_REGISTRY["family-table"].status).toBe("accepted");
    expect(NUMBERDROID_PROP_ART_REGISTRY["family-memory-console"].status).toBe("accepted");
    expect(NUMBERDROID_PROP_ART_REGISTRY["coffee-machine"].status).toBe("candidate");
    expect(NUMBERDROID_PROP_ART_REGISTRY["planter-trough"].status).toBe("candidate");
    expect(NUMBERDROID_PROP_ART_REGISTRY["plant-round"].status).toBe("candidate");
    expect(NUMBERDROID_PROP_ART_REGISTRY["transfer-hologram"].status).toBe("candidate");
    expect(NUMBERDROID_PROP_ART_REGISTRY["transfer-core"].status).toBe("accepted");
    expect(NUMBERDROID_PROP_ART_REGISTRY["flow-station"].status).toBe("candidate");
  });

  it("leaves unregistered production art as an intentional blockout fallback", () => {
    expect(NUMBERDROID_PROP_ART_REGISTRY["child-bed"]).toBeUndefined();
    expect(NUMBERDROID_PROP_ART_REGISTRY["primus-service-bank"]).toBeUndefined();
  });
});
