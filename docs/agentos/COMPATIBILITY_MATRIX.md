# AgentOS Compatibility Matrix (V2.10 Wave 5)

| Component | Version | Status |
|-----------|---------|--------|
| App / AgentOS | 2.10.0-wave5 | SUPPORTED |
| Schema | 2.10.5 | SUPPORTED |
| Worker | 2.10.5 | SUPPORTED |
| Job payload | 1 | SUPPORTED |
| API | v2.10 | SUPPORTED |
| Redis (ioredis via REDIS_URI) | project default | SUPPORTED |
| DB Sequelize | project default | SUPPORTED |
| Node | conforme package engines | SUPPORTED |
| Frontend | mesma release | SUPPORTED |
| Bull queue AgentOS | bull (projeto) | SUPPORTED |
| MCP SDK | versão do projeto | TEMPORARILY_SUPPORTED |
| Provider adapters | existentes | TEMPORARILY_SUPPORTED |
| Job payload v0 (legado sem `v`) | — | UNSUPPORTED (DLQ/reject) |
| AgentOS < 2.10 Wave 1 schema | — | UNSUPPORTED |

Rolling deploy: versão antiga e nova de app podem coexistir se job payload `v=1` for respeitado.
