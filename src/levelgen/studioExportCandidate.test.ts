import { describe, expect, it } from "vitest";
// @ts-expect-error Checkpoint 5 deliberately crosses into the JavaScript-only Studio adapter boundary.
import { createNumberdroidExportSnapshot } from "../../tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js";
// @ts-expect-error The fixed canonical compiler bridge is an executable ESM boundary, not application code.
import { buildCandidateWithCanonicalCompiler } from "../../scripts/validation/validate-studio-export-candidate.mjs";

function floorPlacements(width: number, height: number) {
  return Array.from({ length: width * height }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    return {
      placementId: `floor.${x}.${y}`,
      assetId: "asset.floor",
      assetVersion: 1,
      metadataVersion: 1,
      layer: "STRUCTURAL_SURFACE",
      anchor: { x, y },
      rotation: 0,
      variantTag: null,
      proposalId: null,
      proposalItemId: null,
    };
  });
}

function snapshot() {
  const sliceDigest = "1".repeat(64);
  const sourceDigest = "2".repeat(64);
  const propSliceDigest = "5".repeat(64);
  const propSourceDigest = "6".repeat(64);
  const binding = {
    assetId: "asset.floor",
    assetVersion: 1,
    metadataVersion: 1,
    kind: "floor-material",
    propId: null,
    floorMaterialId: "family-floor",
    runtimePath: "public/assets/deck/family-floor.png",
    sourceArtPath: "art-source/approved/area-01-transfer-ship/family/floor.png",
  };
  const propBinding = {
    assetId: "asset.plant",
    assetVersion: 1,
    metadataVersion: 1,
    kind: "prop",
    propId: "plant-round",
    floorMaterialId: null,
    runtimePath: "public/assets/deck/family-round-plant.png",
    sourceArtPath: "art-source/approved/area-01-transfer-ship/family/plant-round.png",
  };
  const core = {
    schemaVersion: 1,
    kind: "numberdroid.studio.export-snapshot",
    adapterVersion: "numberdroid-studio.adapter.v1",
    project: { projectId: "project.compiler-proof", revision: 7 },
    room: {
      projectId: "project.compiler-proof",
      roomVariantId: "room.compiler-proof",
      version: 3,
      roomArchetypeId: "archetype.domestic",
      archetypeVersion: 1,
      displayName: "Compiler Proof",
      lifecycle: "FINAL",
      width: 4,
      height: 3,
      origin: { x: 0, y: 0 },
      intentTrace: [],
      connectors: [],
      placements: [
        ...floorPlacements(4, 3),
        {
          placementId: "plant.primary",
          assetId: "asset.plant",
          assetVersion: 1,
          metadataVersion: 1,
          layer: "SET_DRESSING",
          anchor: { x: 2, y: 1 },
          rotation: 0,
          variantTag: null,
          proposalId: null,
          proposalItemId: null,
        },
      ],
      voidCells: [],
      blockedCells: [],
      acceptedWarningFindingIds: [],
      parentVariantVersion: 2,
      parentFinalVersion: null,
      contentFingerprint: "3".repeat(64),
    },
    archetype: {
      projectId: "project.compiler-proof",
      roomArchetypeId: "archetype.domestic",
      version: 1,
      kind: "room",
      displayName: "Domestic",
      tags: ["domestic"],
      dimensionPolicy: {
        width: { min: 3, preferred: 4, max: 64 },
        height: { min: 3, preferred: 3, max: 64 },
      },
      structuralBands: { left: 0, right: 0, top: 0, bottom: 0 },
      orientation: "any",
      connectorPolicy: { min: 0, max: 8, requiredSides: [] },
      allowedAssetKinds: ["surface", "prop", "item"],
      allowedTags: [],
      requiredTags: [],
      rationality: "domestic",
      governingRuleRefs: [],
    },
    assets: [{
      asset: {
        assetId: "asset.floor",
        assetVersion: 1,
        metadataVersion: 1,
        name: "Family floor",
        kind: "surface",
        lifecycle: "FINAL",
        metadata: { role: "base", spanTiles: { width: 1, height: 1 }, runtimeEligible: true },
        metadataFingerprint: "4".repeat(64),
        sliceBinding: {
          sourceId: "source.floor",
          sourceDigest,
          digest: sliceDigest,
          artifactUri: `studio://artifacts/sha256/${sliceDigest}`,
          mediaType: "image/png",
          byteSize: 4096,
          width: 64,
          height: 64,
        },
      },
      source: {
        schemaVersion: 2,
        sourceId: "source.floor",
        intakeId: "intake.floor",
        name: "Family floor source",
        artifactUri: `studio://artifacts/sha256/${sourceDigest}`,
        mediaType: "image/png",
        byteSize: 262144,
        width: 512,
        height: 512,
        provenance: { origin: "human_upload" },
        lifecycle: "APPROVED_SOURCE",
        reviewDisposition: "USER_APPROVED",
      },
      binding,
    }, {
      asset: {
        assetId: "asset.plant",
        assetVersion: 1,
        metadataVersion: 1,
        name: "Round plant",
        kind: "prop",
        lifecycle: "FINAL",
        metadata: { role: "dressing", spanTiles: { width: 1, height: 1 }, runtimeEligible: true },
        metadataFingerprint: "7".repeat(64),
        sliceBinding: {
          sourceId: "source.plant",
          sourceDigest: propSourceDigest,
          digest: propSliceDigest,
          artifactUri: `studio://artifacts/sha256/${propSliceDigest}`,
          mediaType: "image/png",
          byteSize: 4096,
          width: 64,
          height: 64,
        },
      },
      source: {
        schemaVersion: 2,
        sourceId: "source.plant",
        intakeId: "intake.plant",
        name: "Round plant source",
        artifactUri: `studio://artifacts/sha256/${propSourceDigest}`,
        mediaType: "image/png",
        byteSize: 262144,
        width: 512,
        height: 512,
        provenance: { origin: "human_upload" },
        lifecycle: "APPROVED_SOURCE",
        reviewDisposition: "USER_APPROVED",
      },
      binding: propBinding,
    }],
    adapterBindings: { schemaVersion: 1, assets: [binding, propBinding] },
    artifactVerifications: {
      schemaVersion: 1,
      verifierVersion: "numberdroid-studio.cas-integrity.test.v1",
      artifacts: [
        { digest: sliceDigest, byteSize: 4096, mediaType: "image/png", width: 64, height: 64 },
        { digest: sourceDigest, byteSize: 262144, mediaType: "image/png", width: 512, height: 512 },
        { digest: propSliceDigest, byteSize: 4096, mediaType: "image/png", width: 64, height: 64 },
        { digest: propSourceDigest, byteSize: 262144, mediaType: "image/png", width: 512, height: 512 },
      ],
    },
    exportProfile: {
      schemaVersion: 1,
      levelId: "studio.compiler-proof",
      seed: "studio-compiler-proof-v3",
      sizeClass: "small",
      corridorOrientation: "any",
      floorName: "COMPILER PROOF",
      subtitle: null,
      objectiveDefault: null,
      objectiveAfterEnergy: null,
    },
  };
  const rawSources = core.assets.map((entry) => ({
    ...entry.source,
    id: entry.source.sourceId,
    lifecycle: { state: entry.source.lifecycle },
    review: { disposition: entry.source.reviewDisposition },
  }));
  return createNumberdroidExportSnapshot({
    projectDocument: {
      projectId: core.project.projectId,
      revisions: [{
        number: core.project.revision,
        snapshot: {
          sources: rawSources,
          assetLibrary: { schemaVersion: 1, assets: core.assets.map((entry) => entry.asset), proposals: [] },
          roomLibrary: {
            schemaVersion: 1,
            archetypes: [core.archetype],
            variants: [{ roomVariantId: core.room.roomVariantId, headVersion: core.room.version, versions: [core.room] }],
            proposals: [],
          },
        },
      }],
    },
    roomVariantId: core.room.roomVariantId,
    roomVariantVersion: core.room.version,
    adapterBindings: core.adapterBindings,
    artifactVerifications: core.artifactVerifications,
    exportProfile: core.exportProfile,
    adapterVersion: core.adapterVersion,
  });
}

describe("Studio export candidate canonical compiler bridge", () => {
  it("loads the real compiler and override validator through a fixed, deterministic bridge", async () => {
    const first = await buildCandidateWithCanonicalCompiler(snapshot());
    const second = await buildCandidateWithCanonicalCompiler(snapshot());

    expect(first.status).toBe("BLOCKED");
    expect(first.manifest.compiler.status).toBe("SUCCEEDED");
    expect(first.manifest.compiler.version).toMatch(/^numberdroid-level-compiler\.sha256:[a-f0-9]{64}$/);
    expect(first.manifest.compiler.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.manifestHash).toBe(second.manifestHash);
    expect(first.manifestJson).toBe(second.manifestJson);
    expect(first.levelSpec.overrides[0]).toMatchObject({
      targetId: "space.room.compiler-proof",
      lockGeometry: true,
      lockedGeometry: { sizeTiles: { w: 4, h: 3 } },
    });
    expect(first.levelSpec.overrides[1]).toMatchObject({
      targetId: "prop-placement.plant.primary",
      lockPlacement: true,
      lockedPlacement: { offsetTiles: { x: 2, y: 1 }, rotation: 0 },
    });
    expect(first.findings.some((finding: { ruleId: string }) => finding.ruleId === "numberdroid.adapter.locked_placement_mismatch")).toBe(false);
    expect(first.manifest.stages).toEqual({
      candidate: "BLOCKED",
      materialize: "NOT_AUTHORIZED",
      commit: "NOT_AUTHORIZED",
      publish: "NOT_AUTHORIZED",
    });
  });
});
