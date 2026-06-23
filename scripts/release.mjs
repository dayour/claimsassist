import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  REQUIRED_TABLES,
  SOLUTION_UNIQUE_NAME,
  SOURCE_ENVIRONMENT_URL,
  TARGET_ENVIRONMENT_URL,
} from "./owcp-contract.mjs";

const flags = new Set(process.argv.slice(2));

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function pac(args) {
  run("pac", args);
}

function build() {
  run("npm", ["run", "build"]);
}

function validateZip(path) {
  run("node", ["scripts/validate-solution.mjs", path]);
}

function addRequiredTableComponents() {
  for (const table of REQUIRED_TABLES.slice(1)) {
    pac([
      "solution",
      "add-solution-component",
      "--environment",
      SOURCE_ENVIRONMENT_URL,
      "--solutionUniqueName",
      SOLUTION_UNIQUE_NAME,
      "--component",
      table.schemaName,
      "--componentType",
      "1",
      "--AddRequiredComponents",
    ]);
  }
}

function exportSolution() {
  addRequiredTableComponents();
  pac([
    "solution",
    "export",
    "--environment",
    SOURCE_ENVIRONMENT_URL,
    "--name",
    SOLUTION_UNIQUE_NAME,
    "--path",
    "solution/ClaimStudio_unmanaged.zip",
    "--overwrite",
    "--max-async-wait-time",
    "60",
  ]);
  pac([
    "solution",
    "export",
    "--environment",
    SOURCE_ENVIRONMENT_URL,
    "--name",
    SOLUTION_UNIQUE_NAME,
    "--path",
    "solution/ClaimStudio_managed.zip",
    "--managed",
    "--overwrite",
    "--max-async-wait-time",
    "60",
  ]);
}

function importToTarget() {
  const packagePath = flags.has("--managed") ? "solution/ClaimStudio_managed.zip" : "solution/ClaimStudio_unmanaged.zip";
  if (!existsSync(packagePath)) throw new Error(`${packagePath} does not exist`);
  validateZip(packagePath);
  pac([
    "solution",
    "import",
    "--environment",
    TARGET_ENVIRONMENT_URL,
    "--path",
    packagePath,
    "--publish-changes",
    "--max-async-wait-time",
    "60",
  ]);
  pac(["solution", "publish", "--environment", TARGET_ENVIRONMENT_URL]);
}

build();

if (flags.has("--export")) exportSolution();

validateZip("solution/ClaimStudio_unmanaged.zip");
if (existsSync("solution/ClaimStudio_managed.zip")) validateZip("solution/ClaimStudio_managed.zip");

if (flags.has("--deploy")) importToTarget();

console.log("Release checks completed.");