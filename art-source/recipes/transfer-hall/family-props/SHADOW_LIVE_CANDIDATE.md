# Family Table Grounding Shadow — Live Candidate

Status: `LIVE_CANDIDATE` pending Art-Director live QA.

This bounded candidate adds a dedicated 3×2 FloorFX grounding shadow beneath the accepted Family Table visual candidate.

Runtime contract:

- FloorFX candidate GIDs: `167–172`
- map placement: col 2,row 4, 3×2
- runtime asset: `/assets/deck/family-table-shadow.png`
- runtime size: 192×128 px
- source: `source/family-table-shadow-runtime.b64.00`
- bytes: 24958
- SHA-256: `73e859340d7021c1492ce272e1e4ff4c6cba889b9cd70b12335f79e212b5e9f9`
- existing Family Table FloorProps remain GIDs `161–166`
- existing collision remains unchanged
- legacy FloorFX atlas/GIDs remain intact; only the Family Table placement routes to the appended shadow tileset

Visual intent:

- subtle neutral-charcoal grounding only;
- tighter contact weighting near the furniture footprint plus a broader low-opacity ambient footprint;
- no colored glow, floor texture, lighting state or gameplay semantics;
- FloorFX owns the shadow; the prop remains clean and independently replaceable.

This file records the temporary candidate state so the main family-props recipe does not prematurely mark the shadow accepted. After live QA, fold the accepted/rejected result into `recipe.md` and remove or archive this candidate note as appropriate.
