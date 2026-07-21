# Client Packet Contract

A client packet is the local, client-scoped unit of audit configuration. It keeps source material, canonical guidance, run outputs, and reports separated by client.

Phase 1 supports local client packets with canonical modules copied from reviewed source material and source snapshots recorded in `source-manifest.json`. It does not perform live connector ingestion, page extraction, LLM judging, or report generation.

## Required Layout

```text
clients/<client-id>/
  client.yaml
  source-manifest.json
  canonical/
    icp.md
    positioning.md
    buyer-language.md
    proof-library.md
    objections.md
    content-priorities.md
  sources/
    local/
  targets/
    site-pages.yaml
```

Future phases add more canonical modules, source snapshots, audit targets, runs, and reports.

## `client.yaml`

```yaml
clientId: demo-client
name: Demo Client
description: Optional human-readable note
canonicalModules:
  - positioning
requiredCanonicalModules:
  - positioning
```

Rules:

- `clientId` must match `source-manifest.json`.
- `canonicalModules` lists the modules available for the packet.
- `requiredCanonicalModules` lists modules that must have a manifest registry entry and a readable local file.

## `source-manifest.json`

```json
{
  "clientId": "demo-client",
  "generatedAt": "2026-06-20T00:00:00.000Z",
  "sources": [
    {
      "id": "demo-client-positioning-source",
      "clientId": "demo-client",
      "type": "local",
      "tier": "canonical",
      "trustLevel": "provisional",
      "title": "Positioning",
      "path": "canonical/positioning.md",
      "checksum": "example"
    }
  ],
  "canonicalRegistry": [
    {
      "moduleId": "positioning",
      "clientId": "demo-client",
      "path": "canonical/positioning.md",
      "readiness": "partial",
      "provenance": ["demo-client-positioning-source"]
    }
  ]
}
```

Rules:

- Every source and canonical registry entry must belong to the same `clientId` as the packet.
- Every canonical registry entry must include at least one `provenance` source ID.
- Every provenance source ID must exist in `sources`.
- Local source paths are validated when `path` is present.
- Every required canonical module must have a registry entry.
- Every required canonical module registry entry must point to a readable local file.

## Supported Packet Status Values

Readiness:

- `strong`
- `partial`
- `missing`

Trust level:

- `trusted`
- `provisional`
- `foundational`
- `unverified`

Source tier:

- `source_of_truth`
- `canonical`
- `foundational`
- `audit_target`
- `context`
