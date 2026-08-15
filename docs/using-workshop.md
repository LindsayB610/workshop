# Using Workshop

Workshop is a desktop home for small local tools. The app code is public, but
your working files stay on your computer. A new installation starts with an
empty shelf by design: install only the tools you want to use.

This guide begins after Workshop is open. If you need to install it first, use
the [README](../README.md#install-workshop) for the supported public installer
or source-development path.

Slate and Pulse are currently available. Slate displays Markdown files that you
explicitly list in a private configuration file; Pulse manages recurring
personal reminders through its own private runner.

## Connect Slate

### 1. Install Slate

1. Open Workshop.
2. Select **Add New Tools**.
3. Find **Slate** and choose **Install**.
4. Open Slate from the Workshop shelf.

Installing or removing Slate changes only Workshop's local tool list. It never
deletes your Markdown files or private configuration.

### 2. Create a private Slate folder

Create a folder outside the Workshop repository and outside the Slate source
repository. For example:

```text
~/Documents/workshop-private/
  slate/
    slate.config.json
```

The Markdown files can live anywhere on your computer. The configuration below
is the only place Slate learns their locations.

### 3. Add your sources

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

### 4. Connect

In Slate, enter or choose the folder containing `slate.config.json`, then
select **Connect**. Choose a source from Slate to read it. Slate watches the
configured files, so updates to those files appear after it refreshes.

If Slate cannot connect, make sure you selected the folder—not the
`slate.config.json` file itself—and that every configured path is absolute and
points to an existing Markdown file.

## Connect Pulse

1. Open **Add New Tools** and install **Pulse**.
2. Open Pulse from the shelf.
3. If asked, select the private folder that contains `pulse.config.json`—for
   example, `~/Documents/workshop-private/pulse`.
4. Complete Pulse’s **Connect Pulse** flow. Workshop keeps the configured
   credential in the operating-system keychain while Pulse receives only the
   constrained service access it needs.

Workshop remembers that folder after a successful connection. Pulse owns its
dashboard, reminder timing, history, and runner-health screens. For
private-runner deployment, Android setup, backup guidance, and the exact public
`pulse.config.json` example, use the [Pulse repository](https://github.com/LindsayB610/pulse).

## Keep Workshop up to date

The packaged app checks for signed updates every time it opens, then once every
24 hours while it remains open. Choose **Workshop → Check for Updates…** or
open **Workshop → Preferences… → Updates** when you want to check immediately.
If Workshop shows **Update available**, choose it to install the signed update
and restart the app. You can continue using the current version if no update is
available or you are offline.

## Privacy and recovery

- Keep private folders outside the Workshop repository so they cannot be
  committed accidentally.
- Workshop receives only Slate's configured source metadata (`id`, `label`, and
  `view`) to build the interface. It does not copy source paths or Markdown
  contents into the repository or upload them.
- Slate can read only the files explicitly declared in `slate.config.json`.
  It does not search nearby folders or fall back to unrelated data.
- Folder actions in **Workshop → Preferences…** can review, change, reconnect,
  or forget remembered locations. They never modify, move, or delete private
  files.

Redline and Megaphone remain registered as future tools. See
[private-workspaces.md](private-workspaces.md) for the broader private-data
layout and [troubleshooting-public-workspaces.md](troubleshooting-public-workspaces.md)
for help with local workspace issues.
