import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { WORKSHOP_VERSION } from "./appVersion";
import { WORKSHOP_UPDATE_ENDPOINT } from "./updater/updateMetadata";
import { createTauriUpdaterClient } from "./updater/tauriUpdaterClient";
import type { WorkshopUpdaterClient, WorkshopUpdateState } from "./updater/types";
import {
  createInitialUpdateState,
  installWorkshopUpdate,
  runStartupWorkshopUpdateCheck,
} from "./updater/workshopUpdater";

export function createPreviewUpdaterClient(): WorkshopUpdaterClient {
  return {
    async check() {
      return { available: false };
    },
    async install() {
      throw new Error("Install updates from the packaged Workshop app.");
    },
  };
}

export function getUpdaterClient(): WorkshopUpdaterClient {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__
    ? createTauriUpdaterClient()
    : createPreviewUpdaterClient();
}

export function SettingsPanelView({
  updateState,
  onInstallUpdate,
  visibility = "always",
}: {
  updateState: WorkshopUpdateState;
  onInstallUpdate: () => void;
  visibility?: "always" | "actionable";
}) {
  const isActionable =
    updateState.status === "available" ||
    updateState.status === "installing" ||
    updateState.status === "installed" ||
    updateState.status === "error";

  if (visibility === "actionable" && !isActionable) {
    return null;
  }

  const isInstalling = updateState.status === "installing";
  const isInstalled = updateState.status === "installed";

  return (
    <section className="settings-panel" aria-label="Workshop update status">
      <div className="settings-summary">
        <div>
          <ShieldCheck size={17} aria-hidden="true" />
          <strong>Workshop v{updateState.currentVersion}</strong>
        </div>
        <span>Updates check on launch and restart after install.</span>
        <div className="settings-status">
          <Badge tone={updateState.status === "error" ? "red" : "pink"}>
            {updateState.status}
          </Badge>
        </div>

        {updateState.status === "available" || isInstalling || isInstalled ? (
          <Button
            className={isInstalled ? "update-installed-button" : "update-available-button"}
            disabled={isInstalling || isInstalled}
            onClick={onInstallUpdate}
          >
            {isInstalling ? <LoaderCircle size={16} aria-hidden="true" /> : null}
            {isInstalled ? <CheckCircle2 size={16} aria-hidden="true" /> : null}
            {updateState.status === "available" ? <RefreshCw size={16} aria-hidden="true" /> : null}
            {isInstalling ? "Installing and restarting" : null}
            {isInstalled ? "Update installed" : null}
            {updateState.status === "available" ? "Install and restart" : null}
          </Button>
        ) : null}
      </div>

      {isInstalled ? (
        <p className="update-note">
          Workshop v{updateState.latestVersion ?? updateState.currentVersion} installed. Workshop
          should restart automatically.
        </p>
      ) : updateState.latestVersion ? (
        <p className="update-note">
          v{updateState.latestVersion} is available. Installing it will restart Workshop.{" "}
          {updateState.notes ?? "No release notes were provided."}
        </p>
      ) : null}

      {updateState.error ? <p className="settings-error">{updateState.error}</p> : null}

      <span className="sr-only">{WORKSHOP_UPDATE_ENDPOINT}</span>
    </section>
  );
}

export function SettingsPanel({
  visibility = "always",
}: {
  visibility?: "always" | "actionable";
}) {
  const updaterClient = useMemo(() => getUpdaterClient(), []);
  const didRunUpdateCheck = useRef(false);
  const [updateState, setUpdateState] = useState<WorkshopUpdateState>(
    createInitialUpdateState(WORKSHOP_VERSION),
  );

  useEffect(() => {
    if (didRunUpdateCheck.current) {
      return;
    }

    didRunUpdateCheck.current = true;
    setUpdateState((state) => ({ ...state, status: "checking", error: undefined }));
    void runStartupWorkshopUpdateCheck(WORKSHOP_VERSION, updaterClient).then(setUpdateState);
  }, [updaterClient]);

  async function handleInstallUpdate() {
    setUpdateState((state) => ({ ...state, status: "installing", error: undefined }));
    setUpdateState(await installWorkshopUpdate(updateState, updaterClient));
  }

  return (
    <SettingsPanelView
      updateState={updateState}
      onInstallUpdate={handleInstallUpdate}
      visibility={visibility}
    />
  );
}
