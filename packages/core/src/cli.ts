#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { prepareEditBriefFromJson } from "./editBrief.js";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function usage(): string {
  return [
    "Usage:",
    "  redline prepare-edit-brief --report <agent-edit-plan.json> [--out <edit-brief.md>]",
    "",
  ].join("\n");
}

function valueAfterFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

export function runCli(args: string[]): CliResult {
  const [command] = args;

  if (command !== "prepare-edit-brief") {
    return {
      exitCode: 1,
      stdout: "",
      stderr: usage(),
    };
  }

  const reportPath = valueAfterFlag(args, "--report");
  const outPath = valueAfterFlag(args, "--out");

  if (!reportPath) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Missing required --report path.\n\n${usage()}`,
    };
  }

  try {
    const artifact = prepareEditBriefFromJson(readFileSync(reportPath, "utf8"));

    if (outPath) {
      writeFileSync(outPath, `${artifact.markdown}\n`, "utf8");
      return {
        exitCode: 0,
        stdout: `Wrote edit brief to ${outPath}\n`,
        stderr: "",
      };
    }

    return {
      exitCode: 0,
      stdout: artifact.markdown,
      stderr: "",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? `${error.message}\n` : "Unknown error.\n",
    };
  }
}

const isDirectRun = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;

if (isDirectRun) {
  const result = runCli(process.argv.slice(2));

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exitCode = result.exitCode;
}
