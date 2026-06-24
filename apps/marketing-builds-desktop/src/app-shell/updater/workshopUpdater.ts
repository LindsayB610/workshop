import type {
  WorkshopUpdateCheckResult,
  WorkshopUpdaterClient,
  WorkshopUpdateState,
} from "./types";

export function createInitialUpdateState(currentVersion: string): WorkshopUpdateState {
  return {
    currentVersion,
    status: "idle",
  };
}

export function updateErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

export async function checkForWorkshopUpdate(
  currentVersion: string,
  client: Pick<WorkshopUpdaterClient, "check">,
): Promise<WorkshopUpdateState> {
  try {
    const result = await client.check();

    if (result.available) {
      return updateResultToState(currentVersion, result);
    }

    return {
      currentVersion,
      status: "not_available",
    };
  } catch (error) {
    return {
      currentVersion,
      status: "error",
      error: updateErrorMessage(error, "Unknown update error."),
    };
  }
}

export async function installWorkshopUpdate(
  state: WorkshopUpdateState,
  client: Pick<WorkshopUpdaterClient, "install">,
): Promise<WorkshopUpdateState> {
  try {
    await client.install();

    return {
      ...state,
      status: "installed",
      error: undefined,
    };
  } catch (error) {
    return {
      ...state,
      status: "error",
      error: updateErrorMessage(error, "Unknown install error."),
    };
  }
}

export async function runStartupWorkshopUpdateCheck(
  currentVersion: string,
  client: Pick<WorkshopUpdaterClient, "check">,
): Promise<WorkshopUpdateState> {
  return checkForWorkshopUpdate(currentVersion, client);
}

function updateResultToState(
  currentVersion: string,
  result: Extract<WorkshopUpdateCheckResult, { available: true }>,
): WorkshopUpdateState {
  return {
    currentVersion,
    latestVersion: result.version,
    notes: result.notes,
    status: "available",
  };
}
