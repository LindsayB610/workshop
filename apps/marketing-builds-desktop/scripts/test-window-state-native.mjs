import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

if (process.platform !== "darwin") {
  throw new Error("Workshop's hidden native window smoke check requires macOS.");
}

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (command, args, timeout) => {
  const result = spawnSync(command, args, {
    cwd: desktopRoot,
    encoding: "utf8",
    timeout,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed (${result.signal ?? result.status})`);
};

run("cargo", ["build", "--locked", "--manifest-path", "src-tauri/Cargo.toml", "--example", "window_state_smoke"], 600_000);
// This native harness disables activation before its event loop, uses only a
// hidden/unfocused incognito webview, and never loads the installed app profile.
const metadata = spawnSync("cargo", ["metadata", "--locked", "--no-deps", "--format-version", "1", "--manifest-path", "src-tauri/Cargo.toml"], {
  cwd: desktopRoot,
  encoding: "utf8",
  timeout: 10_000,
});
if (metadata.error) throw metadata.error;
assert.equal(metadata.status, 0, metadata.stderr);
const targetRoot = JSON.parse(metadata.stdout).target_directory;
const binary = path.join(targetRoot, "debug/examples/window_state_smoke");
const stateRoot = mkdtempSync(path.join(tmpdir(), "workshop-window-state-native-"));
try {
  for (const mode of ["save", "restore", "close", "restore", "maximized", "corrupt", "numeric-corrupt", "offscreen", "unwritable"]) {
    run(binary, [mode, stateRoot], 10_000);
    if (mode === "unwritable") {
      assert.ok(statSync(path.join(stateRoot, "window-state.json")).isDirectory());
      console.log("An unwritable state file did not block the native session or exit.");
      continue;
    }
    const saved = JSON.parse(readFileSync(path.join(stateRoot, "window-state.json"), "utf8"));
    assert.ok(saved.main.width > 0 && saved.main.height > 0);
    if (mode === "save" || mode === "close") {
      const expected = JSON.parse(readFileSync(path.join(stateRoot, "expected.json"), "utf8"));
      for (const [key, value] of Object.entries(expected)) assert.equal(saved.main[key], value);
      console.log(`${mode === "close" ? "Window close" : "Normal exit"} persisted the actual native bounds.`);
    }
  }
  console.log("All nine hidden native persistence checks passed.");
} finally {
  rmSync(stateRoot, { recursive: true, force: true });
}
