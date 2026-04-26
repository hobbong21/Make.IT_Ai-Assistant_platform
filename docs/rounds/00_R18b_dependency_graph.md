# R18b: Feature Dependency Graph Visualization

**Date**: 2026-04-26  
**Architect**: @hobbong21  
**Scope**: Analyze and visualize dependencies across 17 features + 4 implicit platform features

## Summary

Built comprehensive dependency graph for 21 MaKIT features, extracting internal/external dependencies from manifest.json files created in R18a. Generated 3 artifacts:

1. **DEPENDENCY_GRAPH.md** (9.8 KB): Mermaid diagram + detailed layered analysis + coupling/scaling insights
2. **dependency-graph.svg** (11 KB): Hand-coded SVG with grouped boxes per category, D1 color tokens
3. **dependencies.json** (7.2 KB): Machine-readable graph in JSON format

## Key Findings

### Architecture Layers (4 tiers)

**Foundation (0)**: audit (20 dependents) — every feature depends
**Infrastructure (1)**: auth (17), dashboard, ai, jobs
**Platform Services (2)**: notifications, push, pwa, i18n, admin, jobs
**Product (3)**: 10 independent AX services (nlp, youtube-*, feed, remove-bg, modelshot, chatbot, review)
**Composite (4)**: marketing-hub (most depended-on consumer, 4 deps)

### Dependency Heatmap

| Feature | In-Degree | Role |
|---------|-----------|------|
| **audit** | 0 | Foundation (20 incoming) |
| **auth** | 1 | Critical infrastructure (17 incoming) |
| **marketing-hub** | 4 | Highest consumer (auth, audit, ai, notifications) |
| Product layer (10) | 2 | Independent leaves (auth, audit only) |

### DAG Verification ✅

- No cycles detected
- All dependencies flow downward
- Deployment order fully deterministic

### Scaling Insights

**Parallel Development**: All 10 product features can be developed independently (each depends only on auth+audit)  
**Low Coupling**: New AI feature? Use (auth, audit, bedrock) pattern  
**High Risk Points**: audit/auth performance = platform stability

## Artifacts

### 1. DEPENDENCY_GRAPH.md
- Mermaid flowchart (5 subgraphs: Platform Foundation/Services, AX Data/Marketing/Commerce, Hub)
- Korean labels per design spec
- 5 analysis sections:
  - **Layered Architecture**: 4 tiers with rationale
  - **Dependency Heatmap**: In/out degree table
  - **Cycle Detection**: DAG ✅ + recommended deployment order
  - **Coupling Analysis**: High/low coupling features
  - **Scalability**: Parallel dev zones, future patterns
  - **External Dependencies**: Critical (PostgreSQL, Bedrock) vs optional (Redis, Chart.js)

### 2. dependency-graph.svg
- Grouped layout: 6 columns (Platform Foundation/Services, AX Data/Marketing/Commerce, Composite Hub)
- D1 color tokens: platform=#dce1f9, axdata=#d7efdc, axmkt=#fef3c7, axcom=#fee2e2, hub=#e8d5f2
- Valid SVG (no XML errors, proper namespace)
- 800x600 viewBox, legend, statistics block

### 3. dependencies.json
```json
{
  "generated": "2026-04-26T...",
  "features": [
    { "name": "auth", "category": "platform", "dependsOn": [...], "dependedBy": [...] }
  ],
  "stats": {
    "totalFeatures": 21,
    "platformLayer": 11,
    "axDataLayer": 5,
    "topDependedOn": ["audit", "auth", ...],
    "isolatedFeatures": []
  }
}
```

## Documentation Updates

**features/INDEX.md**:
- Added 📊 quick-ref link: "[기능 의존성 그래프](DEPENDENCY_GRAPH.md)"
- Updated folder tree to show 3 new files (DEPENDENCY_GRAPH.md, dependencies.json, dependency-graph.svg)
- Updated timestamp: R18b

## Files Created/Modified

```
features/
├── DEPENDENCY_GRAPH.md (9.8 KB) — Markdown diagram + analysis
├── dependencies.json (7.2 KB) — Machine-readable JSON
├── dependency-graph.svg (11 KB) — SVG visualization
└── INDEX.md (updated) — Added dependency graph link
```

## Verification Checklist

- [x] All 17 manifest.json files parsed
- [x] 21 features + implicit platform features mapped
- [x] Internal dependencies normalized (dashboard → dashboard, ai → ai)
- [x] DAG verified (no cycles)
- [x] Mermaid syntax valid (5 subgraphs, classDef applied)
- [x] SVG well-formed XML, D1 colors applied
- [x] JSON valid and parseable
- [x] INDEX.md link added
- [x] Korean labels throughout

## Next Steps (R18c onwards)

**Suggested enhancements**:
1. Feature lifecycle UI in admin-dashboard (experimental → beta → stable tracker)
2. Dependency violation linter (prevent new dependencies on isolated features)
3. Coupling metrics dashboard (track audit/auth load over time)
4. Automated deployment order generator (topological sort + conflict detection)

---

**Status**: ✅ R18b COMPLETE  
**Lines Changed**: +50 (INDEX.md), +400 (DEPENDENCY_GRAPH.md markdown), +200 (SVG), +300 (JSON)  
**No backend/frontend/tests modified** (architecture layer only)
