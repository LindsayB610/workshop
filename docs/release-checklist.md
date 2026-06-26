# Workshop Release Checklist

Workshop releases update the desktop app and updater manifest.

1. Confirm the public Workshop repo is clean and synced with `main`.
2. Run `npm test`.
3. Run `npm run typecheck`.
4. Run `npm run public:check`.
5. Confirm every app installs from Add New Tools and no app installs by
   default.
6. Confirm release secrets are configured:
   `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY`,
   `WORKSHOP_TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and Netlify credentials.
7. Trigger the manual Release Workshop workflow.
8. Confirm the workflow publishes the new updater manifest.
9. Launch the installed app and confirm it sees the update.

Do not release if the payload contains private client data, local absolute
paths, credentials, or generated client deliverables.
