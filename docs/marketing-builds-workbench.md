# Marketing Builds Workbench

## Direction

The Tauri app should be a shared desktop workbench for Marketing Builds tools, not a single-purpose Redline app.

When the app opens, the user should choose a tool. Redline is the first tool, but future ideas in `marketing-builds` should be able to become separate sub-tools without inheriting Redline's data model by accident.

## App Shape

```text
Marketing Builds Desktop
  App shell
    Tool launcher
    Workspace picker
    Settings
    Connector status
    Job history
    Logs / diagnostics
  Tool registry
    redline
    future tools
  Shared UI
    shadcn/ui components
    layout primitives
    icons
  Tool modules
    Redline
      onboarding
      client packets
      audits
      reports
    Future Tool
      own routes
      own core package
      own data contracts
```

## Tool Registry Contract

Each tool should declare:

- stable ID
- display name
- description
- icon
- routes
- data root
- required local capabilities
- import actions
- export actions
- health checks

## Boundaries

- Shared shell code can route, display navigation, manage settings, and launch jobs.
- Shared shell code should not know tool-specific scoring, audit, drafting, or reporting rules.
- Each tool owns its core package, schemas, tests, and fixtures.
- Shared services should be boring: file access, workspace paths, connectors, logs, settings, job status.
- Tool outputs should remain tool-scoped and client/project-scoped.

## Redline As First Tool

Redline should be the first workbench module because it already has:

- a real client pilot
- a strong upstream reference in Randall Redline
- client onboarding needs
- local artifacts and reports
- obvious desktop workflows

Its implementation should prove the workbench pattern without turning every future tool into a content audit variant.
