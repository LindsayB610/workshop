export type UpdateCheckStatus =
  | "idle"
  | "checking"
  | "available"
  | "not_available"
  | "downloading"
  | "installing"
  | "installed"
  | "error";

export type WorkshopUpdateManifestPlatform = {
  url: string;
  signature: string;
};

export type WorkshopUpdateManifest = {
  version: string;
  notes?: string;
  pub_date?: string;
  platforms: Record<string, WorkshopUpdateManifestPlatform>;
};

export type WorkshopUpdateState = {
  currentVersion: string;
  latestVersion?: string;
  status: UpdateCheckStatus;
  notes?: string;
  error?: string;
};

export type WorkshopUpdateCheckResult =
  | {
      available: true;
      version: string;
      notes?: string;
    }
  | {
      available: false;
    };

export type WorkshopUpdaterClient = {
  check: () => Promise<WorkshopUpdateCheckResult>;
  install: (onProgress?: (downloaded: number, total?: number) => void) => Promise<void>;
};
