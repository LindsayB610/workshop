# Public Workshop Distribution

Workshop is directly distributed for Apple Silicon Macs as a Developer
ID-signed and Apple-notarized disk image. GitHub Releases is the canonical
installer source; Netlify hosts only the signed files used by Workshop's in-app
updater.

**Current status:** Workshop `v0.1.60` is the first public notarized installer.
Future releases publish to the same stable download URL below.

## Install Workshop

Download the current installer from:

<https://github.com/LindsayB610/workshop/releases/latest/download/Workshop-aarch64.dmg>

The release contains two public assets:

| Asset | Purpose |
| --- | --- |
| `Workshop-aarch64.dmg` | The notarized installer for Apple Silicon Macs. |
| `Workshop-aarch64.dmg.sha256` | SHA-256 checksum for the installer. |

Open the disk image, drag **Workshop** to **Applications**, and launch it from
there. A normal Gatekeeper prompt identifies the Developer ID signer. Do not
disable Gatekeeper or run Terminal bypass commands to install Workshop.

Workshop currently supports Apple Silicon Macs on macOS 11 or later. Intel
Macs, Windows, Linux, iOS, Android, the Mac App Store, and universal binaries
are not supported by this release channel.

## What the signatures mean

- The **Developer ID signature** identifies the publisher to macOS.
- Apple **notarization** lets Gatekeeper verify that Apple scanned the shipped
  disk image. The ticket is stapled to the installer so macOS can validate that
  installer without a live ticket lookup.
- Tauri's separate **updater signature** verifies in-app update archives after
  Workshop is installed.
- The published SHA-256 file lets you independently verify that the downloaded
  DMG matches the release asset.

These checks authenticate Workshop itself. They do not read, upload, move, or
delete private tool folders, credentials, Markdown files, or reminder data.

## Check the download

In Terminal, from the folder containing both downloaded release assets:

```sh
shasum -a 256 Workshop-aarch64.dmg
cat Workshop-aarch64.dmg.sha256
```

The two hexadecimal values must match exactly. If they do not, delete the DMG
and download it again from the GitHub Release.

## Updates and recovery

Workshop checks the signed updater manifest every time it opens and once every
24 hours while it remains open. Choose **Workshop → Check for Updates…** to
check immediately. Updates replace the application only; they do not modify your private folders.

If the installer will not open, download it again from the release page and
check its checksum. If Gatekeeper does not identify Workshop's Developer ID,
stop and report the exact macOS message with the release version. Do not bypass
the warning.

## Maintainer release contract

The manual `Release Workshop` workflow creates a public release only after it:

1. runs the repository quality gates;
2. builds the Apple Silicon Workshop app under the permanent identifier
   `com.lindsaybrunner.workshop`;
3. signs it with a Developer ID Application certificate using Hardened Runtime;
4. verifies the code signature;
5. notarizes and staples the DMG, then validates it with macOS tooling;
6. deploys the signed updater payload to Netlify; and
7. creates GitHub tag `vX.Y.Z` and publishes the notarized DMG plus checksum.

The workflow fails before GitHub Release creation if signing, notarization,
stapling, verification, or updater deployment fails. It never publishes a
"close enough" installer.

The following GitHub Actions secrets are required and must stay out of git:

- `WORKSHOP_APPLE_DEVELOPER_ID_CERTIFICATE` — base64-encoded `.p12` for a
  Developer ID Application certificate.
- `WORKSHOP_APPLE_DEVELOPER_ID_CERTIFICATE_PASSWORD`.
- `WORKSHOP_APPLE_DEVELOPER_ID_SIGNING_IDENTITY` — the exact Developer ID
  Application identity shown by `security find-identity`.
- `WORKSHOP_APPLE_NOTARY_ISSUER_ID`, `WORKSHOP_APPLE_NOTARY_KEY_ID`, and
  `WORKSHOP_APPLE_NOTARY_PRIVATE_KEY` — App Store Connect API credentials for
  `notarytool`.
- Existing updater and deployment secrets:
  `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`,
  `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and `NETLIFY_AUTH_TOKEN`.

Apple account enrollment, certificate issuance, and App Store Connect key
creation are owner-controlled external actions. The repository deliberately
cannot fake them.
