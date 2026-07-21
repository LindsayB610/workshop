import { describe, expect, it } from "vitest";
import { extractPageFromHtml } from "../src/extract.js";
import { buildLiveTargetSnapshot } from "../src/liveTargetSnapshot.js";

describe("live target snapshots", () => {
  it("builds dated, reproducible target artifacts", () => {
    const page = extractPageFromHtml({ id: "demo-home-2026-06-23", url: "https://demo.example/", html: "<title>Demo Home</title><main>Repeatable audit</main>" });
    const snapshot = buildLiveTargetSnapshot({ clientId: "demo-client", url: "https://demo.example/", html: "<title>Demo Home</title><main>Repeatable audit</main>", fetchedAt: "2026-06-23T12:00:00.000Z", checksum: "sha256:test", page });
    expect(snapshot.targetId).toBe("demo-example-2026-06-23");
    expect(snapshot.files.map((file) => file.path)).toContain("clients/demo-client/targets/fixtures/demo-example-2026-06-23.html");
  });
});
