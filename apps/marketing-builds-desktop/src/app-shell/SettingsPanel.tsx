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
  checkForWorkshopUpdate,
} from "./updater/workshopUpdater";
import { delayUntilAutomaticUpdateCheck, recordUpdateCheckAttempt, resolveUpdateSchedule, updateScheduleStorageKey } from "./updater/updateSchedule";

const updateStatusLabels: Record<WorkshopUpdateState["status"], string> = {
  idle: "Waiting to check",
  checking: "Checking for updates",
  available: "Update ready",
  not_available: "you're up to date",
  downloading: "Downloading update",
  installing: "Installing update",
  installed: "Updated",
  error: "Update problem",
};

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

export type WorkshopUpdaterController = {
  updateState: WorkshopUpdateState;
  checkNow: () => Promise<void>;
  installUpdate: () => Promise<void>;
};

function readUpdateSchedule() {
  try {
    return resolveUpdateSchedule(JSON.parse(window.localStorage.getItem(updateScheduleStorageKey) ?? "null"));
  } catch {
    return null;
  }
}

function writeUpdateSchedule(value: ReturnType<typeof readUpdateSchedule>) {
  try {
    if (value) window.localStorage.setItem(updateScheduleStorageKey, JSON.stringify(value));
  } catch {
    // Update checks must not make local storage availability a startup failure.
  }
}

export function useWorkshopUpdater(updaterClient?: WorkshopUpdaterClient): WorkshopUpdaterController {
  const defaultClient = useMemo(() => getUpdaterClient(), []);
  const client = updaterClient ?? defaultClient;
  const timerRef = useRef<number | undefined>(undefined);
  const checkingRef = useRef(false);
  const checkRef = useRef<(source: "automatic" | "manual") => Promise<void>>(async () => undefined);
  const [updateState, setUpdateState] = useState<WorkshopUpdateState>(createInitialUpdateState(WORKSHOP_VERSION));

  function scheduleNext(record = readUpdateSchedule()) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void checkRef.current("automatic"); }, delayUntilAutomaticUpdateCheck(record, Date.now()));
  }

  async function check(source: "automatic" | "manual") {
    if (checkingRef.current) return;
    checkingRef.current = true;
    window.clearTimeout(timerRef.current);
    if (source === "manual") setUpdateState((state) => ({ ...state, status: "checking", error: undefined }));
    const checkedAt = Date.now();
    const result = await checkForWorkshopUpdate(WORKSHOP_VERSION, client);
    const successful = result.status !== "error";
    writeUpdateSchedule(recordUpdateCheckAttempt(readUpdateSchedule(), checkedAt, successful));

    if (source === "manual" || successful || result.status === "available") {
      setUpdateState(result);
    }
    checkingRef.current = false;
    scheduleNext(readUpdateSchedule());
  }

  checkRef.current = check;

  useEffect(() => {
    // A new app launch is an explicit opportunity to discover a just-published
    // signed update. The 24-hour cadence begins only after that launch check.
    void checkRef.current("automatic");
    return () => window.clearTimeout(timerRef.current);
  // The client is stable for the app lifetime; re-creating the schedule would duplicate checks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  async function installUpdate() {
    setUpdateState((state) => ({ ...state, status: "installing", error: undefined }));
    setUpdateState(await installWorkshopUpdate(updateState, client));
  }

  return { updateState, checkNow: () => check("manual"), installUpdate };
}

export function SettingsPanelView({
  updateState,
  onInstallUpdate,
  onCheckForUpdates,
  visibility = "always",
}: {
  updateState: WorkshopUpdateState;
  onInstallUpdate: () => void;
  onCheckForUpdates?: () => void;
  visibility?: "always" | "actionable";
}) {
  const statusLabel = updateStatusLabels[updateState.status];
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
        <span>Checks daily while Workshop is open and restarts after install.</span>
        <div className="settings-status">
          <Badge tone={updateState.status === "error" ? "red" : "pink"}>
            {statusLabel}
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
        {onCheckForUpdates && visibility === "always" ? <Button variant="secondary" disabled={updateState.status === "checking"} onClick={onCheckForUpdates}>{updateState.status === "checking" ? "Checking…" : "Check for updates"}</Button> : null}
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
  controller,
}: {
  visibility?: "always" | "actionable";
  controller?: WorkshopUpdaterController;
}) {
  if (controller) {
    return <SettingsPanelView updateState={controller.updateState} onInstallUpdate={() => { void controller.installUpdate(); }} onCheckForUpdates={() => { void controller.checkNow(); }} visibility={visibility} />;
  }

  return <SelfManagedSettingsPanel visibility={visibility} />;
}

function SelfManagedSettingsPanel({ visibility }: { visibility: "always" | "actionable" }) {
  const ownedController = useWorkshopUpdater();
  return (
    <SettingsPanelView
      updateState={ownedController.updateState}
      onInstallUpdate={() => { void ownedController.installUpdate(); }}
      onCheckForUpdates={() => { void ownedController.checkNow(); }}
      visibility={visibility}
    />
  );
}
