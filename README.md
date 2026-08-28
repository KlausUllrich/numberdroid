# Numberdroid

Cooperative math game for 1–4 children with a Paradroid-inspired robot takeover metagame.

## Repository orientation

Agents must start with:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`

After that universal bootstrap, select the relevant role bundle. Numberdroid
Studio work starts at `tools/numberdroid-studio/README.md`; historical handoffs
are read only when a current plan or prompt names one explicitly.

The repository deliberately separates production code, runtime assets, reproducible art sources, current documentation and historical context.

## Runtime

- `src/` — current React/TypeScript production implementation.
- `public/` — runtime/deploy assets loaded by the game.
- `zahlenkern-prototyp-meta-v7.html` — frozen self-contained prototype reference; do not refactor it into production code.

## Documentation

- `docs/architecture/` — software/map/runtime contracts.
- `docs/game-design/` — gameplay and progression design.
- `docs/story/` — world and narrative foundations.
- `docs/art/` — current art direction and production/category contracts.
- `docs/art-production-methods/` — art method-selection handbook.
- `docs/history/` — old handoffs/experiments; context only, not current authority.

See `docs/README.md` for the current index.

## Art source

`art-source/recipes/` is the preferred reproducible source contract for production art. Runtime PNG/WebP files in `public/` are outputs, not automatically the authoring source of truth.

## Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm test
npm run build
```

Art-related work may require additional scripts from `package.json`, such as seam validation or compositor rendering.

## Public Transfer Hall preview

`https://klausullrich.github.io/numberdroid/?floor=transfer-hall`
