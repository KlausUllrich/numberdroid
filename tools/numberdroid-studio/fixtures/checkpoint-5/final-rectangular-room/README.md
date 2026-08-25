# Checkpoint 5 final rectangular-room golden

This fixture freezes the logical output of the pure adapter test authority. It
contains no bitmap bytes. The four repeated artifact digests are deliberately
synthetic CAS coordinates; the manifest proves runtime/source separation and
text-file determinism without pretending that test images are approved art.

`golden-manifest.json` is verified by
`tests/checkpoint-5-adapter.node-test.js`. The separate root Vitest integration
loads the real Level Spec compiler and fingerprints its current authority files;
that compiler fingerprint is intentionally not pinned in this Studio-only
golden because a reviewed compiler edit must change it.
