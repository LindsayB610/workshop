# Workshop Plugin Host Contract

## Purpose

Workshop is the desktop host, not the owner of a tool’s product logic. Each
tool is developed and versioned in its own GitHub repository and may use a
separate local private-data folder. This contract defines the narrow boundary
between those systems.

## Ownership

| Workshop owns | A tool repository owns | Private local storage owns |
| --- | --- | --- |
| Desktop window, shelf, promotion/install state, shared workbench chrome, capability enforcement, and release shell | Plugin declaration, routes, view, domain models, parsers, tool-specific bridge client, tests, and tool docs | Credentials, real source data, configuration values, runtime state, and generated output |

Workshop must not hard-code a plugin id in application control flow or duplicate
its configuration schema, route labels, source identifiers, parser behavior, or
private-data conventions.

## Plugin Package Surface

An external plugin package must export a data-only declaration and a view. The
package may use React, but it must not import Workshop source files.

```ts
export const workshopPluginDeclaration = {
  contractVersion: 1,
  id: "example-tool",
  displayName: "Example Tool",
  description: "…",
  docsPath: "/docs/tools/example-tool.md",
  workspaceRequirement: "…",
  uninstallSafetyCopy: "…",
  routes: [{ id: "home", label: "Home", path: "/example-tool/home" }],
  navigationMode: "plugin", // or "host"
  requiredLocalCapabilities: ["local-workspace"],
  dataRoots: [],
  importActions: [],
  exportActions: [],
  status: "planned",
  runtime: { kind: "native-bridge", entryPoint: "generic-capability-name" },
  privateWorkspace: { kind: "runner-root", requiredFields: ["tool.config.json"] },
} as const;

export function WorkshopToolView(props: {
  activeRouteId?: string;
  workspaceRoot?: string;
  requestWorkspaceRoot: (root?: string) => void;
}): React.ReactElement;
```

The declaration is the tool’s source of truth. Workshop may add host-only
presentation metadata such as an icon, but it must not rewrite the tool’s
routes, source schema, or domain contract.

## Host Capabilities

Plugins request narrow, generic capabilities. Workshop validates the request
and provides the implementation. Examples include:

- read the configured source metadata (`id`, `label`, and `view`) without
  exposing private paths or file contents;
- read one source declared in a plugin-owned JSON configuration file;
- watch only the declared files and emit a generic change event;
- open an approved external `http`, `https`, or `mailto` URL in the operating
  system's default handler;
- select a private workspace root without persisting private content.

A plugin must not receive arbitrary filesystem access, recursive discovery, or
a host fallback to unrelated data. A future authenticated-service capability
must use a plugin-declared, host-validated allowlist; Workshop must never become
an unrestricted bearer-token proxy.

### External URLs

Plugins invoke `open_external_url` when a user explicitly follows an external
link. Workshop validates the complete URL before handing it to the operating
system opener:

```ts
invoke("open_external_url", { url: "https://example.com/docs" });
```

Only `http`, `https`, and `mailto` schemes are accepted. Web URLs must have a
host; mail links must have a recipient. `file:`, custom protocols,
`javascript:`, `data:`, whitespace, and control characters are rejected.
Plugins must not import a Tauri opener package or attempt `target="_blank"` as
a desktop fallback—the generic host command is the sole native boundary.

For configured Markdown sources, the selected private root contains a regular
JSON file such as `sources.config.json`. Version 1 declares an array of source
objects with `id`, `label`, `view`, and an absolute Markdown `path`. Workshop
validates that configuration, but `read_configured_markdown_sources` returns
only the three display fields. The plugin subsequently requests source text by
the declared `id` through `read_configured_markdown_source`.

```json
{
  "version": 1,
  "sources": [
    {
      "id": "current-state",
      "label": "Current state",
      "view": "current-state",
      "path": "/absolute/path/to/current-state.md"
    }
  ]
}
```

`path` stays private: it is validated by Workshop and is never included in the
metadata response, change event, or plugin declaration.

### Configured secure services

For a plugin that needs an authenticated private service, Workshop provides two
generic native commands. The selected root must be a regular directory outside
any repository; the configuration must be a regular JSON file in that root.

```ts
type SecureServiceMetadata = {
  version: 1;
  endpoint: string;
  credentialRef: string;
};

type SecureServiceRequest = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string; // an origin-relative /api/ path
  body?: unknown;
};

type SecureServiceResponse = { status: number; body: unknown };
```

```ts
invoke("read_secure_service_metadata", { workspaceRoot, configFile });
invoke("request_configured_secure_service", { workspaceRoot, configFile, request });
```

The config has `version`, an HTTPS origin `endpoint`, and a non-secret
`credentialRef`. Workshop looks up the referenced credential in the operating
system keychain under its generic secure-service store; it never returns that
credential to the plugin. In debug builds only, `http://localhost` and
`http://127.0.0.1[:port]` are allowed for local development.

Requests are pinned to the configured origin, accept only the methods above
and `/api/` paths, reject query strings/traversal/control characters, bound
JSON request and response bodies to 64 KiB, and time out after 15 seconds.
Plugins cannot supply authorization headers or an arbitrary destination. Host
errors and responses redact the credential value.

## Promotion

All plugins are hidden until their declaration has `status: "ready"`.
Promotion is a source-controlled owner decision. The host may optionally use
`defaultInstalled: true` in its own registry metadata, but that does not move
tool ownership into Workshop.

## Migration Checklist

Before considering a tool fully external:

1. Move its React view, domain code, parsing, fixtures, and tool-specific tests
   into the tool repository.
2. Export its declaration and `WorkshopToolView` from the tool package.
3. Move tool-specific docs to the tool repository; retain only a short host
   listing if needed.
4. Replace tool-named native commands with a generic host capability, preserving
   least-privilege validation and regression tests.
5. Remove tool-id conditionals and local view imports from Workshop.
6. Pin the external package version in Workshop and verify a clean public clone.
7. Prove that the tool works with its private local folder while no private data
   appears in either GitHub repository.
