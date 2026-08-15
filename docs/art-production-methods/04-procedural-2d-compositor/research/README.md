# M4 Research / Experiment Log

Record compositor experiments here when they teach reusable method behavior rather than only asset-specific art direction.

For each experiment preserve:

- input geometry revision;
- topology/edge classification;
- material source revision;
- render settings;
- output hash;
- single-tile preview;
- assembled/repeated preview;
- automated seam values with negative control;
- visual conclusion;
- next change.

The first TS-01 wall prototype should specifically compare:

1. flat color fill;
2. shared graphite material fill;
3. material + exposed-edge darkening;
4. material + AO;
5. material + restrained highlight;
6. connector exclusion;
7. true-cap treatment.

This pass-by-pass comparison is important: if the final result looks wrong, we need to know which deterministic operation caused it rather than treating the compositor as one opaque effect.