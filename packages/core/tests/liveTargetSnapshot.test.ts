import { describe, expect, it } from "vitest";
import { extractPageFromHtml } from "../src/extract.js";
import { buildLiveTargetSnapshot } from "../src/liveTargetSnapshot.js";

const html = `
<!doctype html>
<html>
  <head>
    <title>Example Home</title>
    <meta name="description" content="A live target fixture.">
  </head>
  <body>
    <main>
      <h1>Live homepage</h1>
      <p>Snapshot this page for repeatable Redline audit review.</p>
    </main>
  </body>
</html>`;

describe("live target snapshots", () => {
  it("builds dated target artifacts from fetched HTML", () => {
    const page = extractPageFromHtml({
      id: "example-test-2026-06-23",
      url: "https://www.example.test/",
      html,
    });
    const snapshot = buildLiveTargetSnapshot({
      clientId: "fixture",
      url: "https://example.test/",
      finalUrl: "https://www.example.test/",
      html,
      fetchedAt: "2026-06-23T12:00:00.000Z",
      checksum: "sha256:test-checksum",
      page,
    });

    expect(snapshot.targetId).toBe("example-test-2026-06-23");
    expect(snapshot.finalUrl).toBe("https://www.example.test/");
    expect(snapshot.page.title).toBe("Example Home");
    expect(snapshot.page.bodyText).toContain("Snapshot this page");
    expect(snapshot.files.map((file) => file.path)).toEqual([
      "clients/fixture/targets/fixtures/example-test-2026-06-23.html",
      "clients/fixture/targets/extracted/example-test-2026-06-23.txt",
      "clients/fixture/targets/snapshots/example-test-2026-06-23.md",
    ]);
    expect(snapshot.files[1].contents).toContain("Title: Example Home");
    expect(snapshot.files[2].contents).toContain("Role: audit_target");
    expect(snapshot.files[2].contents).toContain("Checksum: sha256:test-checksum");
    expect(snapshot.files[2].contents).toContain(
      "Audit target only; do not cite as canonical messaging evidence.",
    );
  });

  it("uses an explicit target id when replaying a known live target", () => {
    const page = extractPageFromHtml({
      id: "queued-parasail-homepage-2026-06-23",
      url: "https://parasail.io/",
      html,
    });
    const snapshot = buildLiveTargetSnapshot({
      clientId: "parasail",
      targetId: "queued-parasail-homepage-2026-06-23",
      url: "https://parasail.io/",
      html,
      fetchedAt: "2026-06-23T12:00:00.000Z",
      page,
    });

    expect(snapshot.targetId).toBe("queued-parasail-homepage-2026-06-23");
    expect(snapshot.htmlPath).toBe(
      "clients/parasail/targets/fixtures/queued-parasail-homepage-2026-06-23.html",
    );
  });
});
