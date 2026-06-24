import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoOnboardingPacket } from "./onboardingModel";
import { exportOnboardingPacket } from "./onboardingActions";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("Redline onboarding actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports onboarding packet files through the constrained Tauri command", async () => {
    invokeMock.mockResolvedValue(demoOnboardingPacket.files.length);
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });

    await expect(
      exportOnboardingPacket(demoOnboardingPacket, { overwrite: false }),
    ).resolves.toEqual({
      status: "exported",
      clientId: "demo-onboarding-draft",
      fileCount: demoOnboardingPacket.files.length,
    });

    expect(invokeMock).toHaveBeenCalledWith("redline_write_packet_files", {
      clientId: "demo-onboarding-draft",
      files: demoOnboardingPacket.files.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
      overwrite: false,
    });
  });

  it("returns a clear unavailable result outside Tauri and clipboard contexts", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});

    await expect(exportOnboardingPacket(demoOnboardingPacket)).resolves.toEqual({
      status: "unavailable",
      clientId: "demo-onboarding-draft",
      message: "Packet export is available in the packaged Workshop app.",
    });
  });
});
