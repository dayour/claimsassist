import { readFileSync } from "node:fs";
import { REQUIRED_TABLES, MODEL_DRIVEN_APP_NAME, SOLUTION_UNIQUE_NAME } from "./owcp-contract.mjs";
import { readZipEntries } from "./zip-utils.mjs";

const zipPath = process.argv[2] ?? "solution/ClaimStudio_unmanaged.zip";
const zip = readZipEntries(readFileSync(zipPath));
const solutionXml = zip.get("solution.xml")?.toString("utf8") ?? "";
const customizationsXml = zip.get("customizations.xml")?.toString("utf8") ?? "";
const lowerSolution = solutionXml.toLowerCase();
const lowerCustomizations = customizationsXml.toLowerCase();
const failures = [];

function requireInCustomizations(value, label) {
  if (!lowerCustomizations.includes(value.toLowerCase())) failures.push(`${label} is missing from customizations.xml`);
}

function requireInSolution(value, label) {
  if (!lowerSolution.includes(value.toLowerCase())) failures.push(`${label} is missing from solution.xml`);
}

requireInSolution(`<uniquename>${SOLUTION_UNIQUE_NAME.toLowerCase()}</uniquename>`, `Solution unique name ${SOLUTION_UNIQUE_NAME}`);
requireInCustomizations(MODEL_DRIVEN_APP_NAME, `Model-driven app ${MODEL_DRIVEN_APP_NAME}`);

for (const table of REQUIRED_TABLES) {
  requireInCustomizations(table.schemaName, `Table ${table.schemaName}`);
  requireInCustomizations(table.logicalName, `Logical table ${table.logicalName}`);
  requireInCustomizations(table.primaryIdAttribute, `Primary id ${table.primaryIdAttribute}`);
  requireInCustomizations(table.primaryNameAttribute, `Primary name ${table.primaryNameAttribute}`);
  for (const column of table.requiredColumns) {
    requireInCustomizations(column, `Column ${table.logicalName}.${column}`);
  }
  if (table.parentLookupAttribute) {
    requireInCustomizations(table.parentLookupAttribute, `Parent lookup ${table.logicalName}.${table.parentLookupAttribute}`);
  }
}

if (failures.length) {
  console.error(`Solution validation failed for ${zipPath}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Solution validation passed for ${zipPath}`);
console.log(`Required OWCP tables: ${REQUIRED_TABLES.map((table) => table.logicalName).join(", ")}`);