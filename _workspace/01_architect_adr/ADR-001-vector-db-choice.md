# ADR-001 — Vector DB choice: pgvector vs OpenSearch

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: architect, with ai-engineer input
- **Supersedes**: —

## Context

The RAG chatbot in AX Commerce Brain needs semantic retrieval over a company knowledge base (FAQ, policy, product docs). Expected v1 corpus: ≤ 50k chunks at 1024-dim embeddings (Titan Embed v2). We must pick a vector store that:

- Serves ANN search with p95 < 200ms over 50k vectors.
- Integrates with Spring Boot 3.2 and Flyway migrations.
- Minimizes operational surface for v1 (single team, Fargate deployment).
- Retains a migration path to a larger engine (> 1M vectors) in v2.

Two realistic candidates were considered: **pgvector** (extension on the PostgreSQL 15 we already need for relational data) and **AWS OpenSearch Service** (managed k-NN engine).

## Decision

**Adopt pgvector for v1.**

- Enable extension in Flyway V202604201200.
- Store embeddings in `knowledge_chunks.embedding VECTOR(1024)`.
- Use IVFFLAT with `vector_cosine_ops`, `lists=100` initially, re-tuned after first 10k rows.
- Wrap all vector access behind the `KnowledgeRetriever` interface. Implementations can be swapped without controller/service changes.

## Consequences

Positive:
- One database to back up, monitor, and secure. No new IAM surface or private-link cost.
- Transactional consistency: document insert + chunk insert + embedding write in one commit. No two-system drift.
- Cheaper in dev and low-traffic prod (same RDS instance).
- Flyway-controlled schema evolution of vector tables alongside everything else.
- Works natively with Hibernate 6 via `com.pgvector:pgvector-hibernate`.

Negative / risks:
- IVFFLAT recall quality depends on `lists` tuning; needs monitoring.
- Latency degrades past ~500k vectors on a t3.medium-class RDS. Mitigated by v2 swap plan.
- No native hybrid (BM25 + vector) scoring. If needed, do lexical pre-filter in SQL (`ILIKE` / `tsvector`) then re-rank.
- All vector load lands on the same DB CPU as transactional queries — must isolate via separate connection pool if saturation shows up.

## Alternatives considered

**AWS OpenSearch Service (k-NN engine)**
- Pro: Higher ceiling (millions of vectors, HNSW, hybrid scoring built in).
- Con: Extra managed service (~$100+/mo even idle), separate IAM + VPC peering, data sync job required between Postgres and OpenSearch, much more operational work for a 50k-chunk corpus. Overkill for v1.

**Pinecone / Qdrant Cloud**
- Pro: Fully managed, fast.
- Con: External dependency, data residency concerns, per-query cost at scale, adds a vendor. Rejected for v1.

**In-memory FAISS in the Spring Boot pod**
- Pro: Lowest latency.
- Con: Rebuild on every pod start, no persistence, breaks with > 1 replica. Rejected.

## Migration path (v2)

Trigger condition: corpus > 500k chunks or ANN p95 > 250ms at steady state.

1. Stand up managed OpenSearch with k-NN plugin.
2. Implement a second `KnowledgeRetriever` impl (e.g. `OpenSearchKnowledgeRetriever`).
3. Backfill via a read job from pgvector.
4. Dual-write during cutover, then flip via config flag.
5. Drop pgvector tables in a later migration.

The `KnowledgeRetriever` interface isolates this change to the `ai` module; controllers and services are untouched.
