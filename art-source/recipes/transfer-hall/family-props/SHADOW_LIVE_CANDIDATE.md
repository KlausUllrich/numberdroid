# Family Table Grounding Shadow — Live Candidate

Status: `LIVE_CANDIDATE` pending Art-Director live QA.

This bounded candidate adds a dedicated 3×2 FloorFX grounding shadow beneath the accepted Family Table visual candidate.

Runtime contract:

- FloorFX candidate GIDs: `167–172`
- map placement: col 2,row 4, 3×2
- runtime asset: `/assets/deck/family-table-shadow.png`
- runtime size: 192×128 px
- source: `source/family-table-shadow-runtime.b64.00`
- bytes: 3699
- SHA-256: `c4cce1f8daebba9d3f96b5f0e064513c7eac874ffedc6ffe00cdba4941398d81`
- existing Family Table FloorProps remain GIDs `161–166`
- existing collision remains unchanged
- legacy FloorFX atlas/GIDs remain intact; only the Family Table placement routes to the appended shadow tileset

Visual intent:

- subtle neutral-charcoal grounding only;
- tighter contact weighting near the furniture footprint plus a broader low-opacity ambient footprint;
- no colored glow, floor texture, lighting state or gameplay semantics;
- FloorFX owns the shadow; the prop remains clean and independently replaceable.

The source is a compact deterministic runtime representation of the approved generated shadow concept; alpha is quantized to a small number of levels to keep the reproducible repository source small without changing the intended gameplay-scale read.

This file records the temporary candidate state so the main family-props recipe does not prematurely mark the shadow accepted. After live QA, fold the accepted/rejected result into `recipe.md` and remove or archive this candidate note as appropriate.
