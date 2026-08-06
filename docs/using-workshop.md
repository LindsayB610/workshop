# Using Workshop

Workshop is a desktop home for small local tools. The app code is public, but
your working files stay on your computer. A new installation starts with an
empty shelf by design: install only the tools you want to use.

Slate is the first tool currently available. It displays Markdown files that
you explicitly list in a private configuration file.

## 1. Keep Workshop Up To Date

The packaged app checks for updates when it opens. If Workshop shows **Update available**, choose it to install the signed update and restart the app. You can continue using the current version if no update is available or you are offline.

## 2. Install Slate

1. Open Workshop.
2. Select **Add New Tools**.
3. Find **Slate** and choose **Install**.
4. Open Slate from the Workshop shelf.

Installing or removing Slate changes only Workshop's local tool list. It never
deletes your Markdown files or private configuration.

## 3. Create A Private Slate Folder

Create a folder outside the Workshop repository and outside the Slate source
repository. For example:

```text
~/Documents/workshop-private/
  slate/
    slate.config.json
```

The Markdown files can live anywhere on your computer. The configuration below
is the only place Slate learns their locations.

## 4. Add Your Sources

Create `slate.config.json` in that private Slate folder. Replace the example
paths with absolute paths to Markdown files you own:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "weekly-notes",
      "label": "Weekly notes",
      "path": "/absolute/path/to/weekly-notes.md",
      "view": "markdown-tabs"
    },
    {
      "id": "reference",
      "label": "Reference",
      "path": "/absolute/path/to/reference.md",
      "view": "markdown"
    }
  ]
}
```

Each source needs a unique lowercase, hyphenated `id`, a human-readable
`label`, an absolute Markdown `path`, and one of these views:

| View | Use it for |
| --- | --- |
| `markdown-tabs` | A Markdown reference that benefits from section tabs. |
| `markdown` | A straightforward Markdown document. |
| `table` | Markdown whose primary content is a table. |

## 5. Connect Slate

In Slate, enter or choose the folder containing `slate.config.json`, then
select **Connect**. Choose a source from Slate to read it. Slate watches the
configured files, so updates to those files appear after it refreshes.

If Slate cannot connect, make sure you selected the folder—not the
`slate.config.json` file itself—and that every configured path is absolute and
points to an existing Markdown file.

## Privacy And Boundaries

- Keep private folders outside the Workshop repository so they cannot be
  committed accidentally.
- Workshop receives only Slate's configured source metadata (`id`, `label`, and
  `view`) to build the interface. It does not copy source paths or Markdown
  contents into the repository or upload them.
- Slate can read only the files explicitly declared in `slate.config.json`.
  It does not search nearby folders or fall back to unrelated data.

Pulse is also available from **Add New Tools**. Select the private folder that
contains `pulse.config.json`, then use Pulse's own connection screen. Workshop
returns only safe service metadata to Pulse and keeps the configured credential
in the operating-system keychain; the Pulse package owns its runner, reminder
data, and management UI.

Redline and Megaphone remain registered as future tools. See
[private-workspaces.md](private-workspaces.md) for the broader private-data
layout and [troubleshooting-public-workspaces.md](troubleshooting-public-workspaces.md)
for help with local workspace issues.
