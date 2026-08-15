import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, statSync } from "node:fs";

const configDir = path.dirname(fileURLToPath(import.meta.url));

type SlatePreviewConfig = { version: 2; ucPath: string; freezerPath: string; opportunitiesPath: string };

function slatePreviewPlugin(slateRoot?: string): Plugin {
  return {
    name: "slate-local-preview",
    configureServer(server) {
      server.middlewares.use("/__slate-preview", (request, response, next) => {
        const source = request.url?.match(/^\/(uc|freezer|opportunities)$/)?.[1] as "uc" | "freezer" | "opportunities" | undefined;
        if (!source || !slateRoot) return next();

        try {
          const config = JSON.parse(readFileSync(path.join(slateRoot, "slate.config.json"), "utf8")) as SlatePreviewConfig;
          const sourcePath = source === "uc" ? config.ucPath : source === "freezer" ? config.freezerPath : config.opportunitiesPath;
          const configuredPaths = [config.ucPath, config.freezerPath, config.opportunitiesPath];
          if (config.version !== 2 || configuredPaths.some((candidate) => !path.isAbsolute(candidate) || !candidate.endsWith(".md")) || new Set(configuredPaths).size !== 3) {
            throw new Error("Slate preview configuration is invalid.");
          }
          const sourceStat = statSync(sourcePath);
          if (!sourceStat.isFile()) throw new Error("Slate preview source is unavailable.");

          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ contents: readFileSync(sourcePath, "utf8"), updatedAt: sourceStat.mtimeMs }));
        } catch {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "Slate preview could not read its configured local source." }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, configDir, "");
  return {
    plugins: [react(), tailwindcss(), slatePreviewPlugin(environment.SLATE_PREVIEW_ROOT)],
    clearScreen: false,
    server: {
      host: "127.0.0.1",
      port: 1420,
      strictPort: true,
      fs: {
        allow: [path.resolve(configDir, "../..")],
      },
    },
    envPrefix: ["VITE_", "TAURI_"],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/slate-core/")) return "plugin-slate";
            if (id.includes("node_modules/@marketing-builds/pulse/")) return "plugin-pulse";
          },
        },
      },
    },
    test: {
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary"],
        include: [
          "src/app-shell/**",
          "src/tool-registry/**",
          "src/tools/toolViews.tsx",
          "src/tools/workspaceRootBrowse.ts",
          "src/App.tsx",
          "scripts/prepare-public-release.mjs",
        ],
        exclude: ["**/*.test.{ts,tsx}", "src/tools/redline/**", "src/tools/megaphone/**"],
        thresholds: {
          statements: 75,
          branches: 74,
          functions: 72,
          lines: 78,
        },
      },
    },
  };
});
