import { REQUIRED_TABLES } from "./owcp-contract.mjs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const environment = (args.get("--environment") ?? process.env.DATAVERSE_ENVIRONMENT_URL ?? "").replace(/\/$/, "");
const requireOneSample = process.argv.includes("--require-one-sample");
const tenant = args.get("--tenant") ?? process.env.DATAVERSE_TENANT ?? "organizations";
const clientId = process.env.DATAVERSE_CLIENT_ID ?? "51f81489-12ee-4a9e-aaae-a2591f45987d";

if (!environment) {
  console.error("Usage: node scripts/validate-dataverse.mjs --environment https://org.crm.dynamics.com [--require-one-sample]");
  process.exit(1);
}

async function requestToken() {
  if (process.env.DATAVERSE_ACCESS_TOKEN) return process.env.DATAVERSE_ACCESS_TOKEN;
  const scope = `${environment}/.default offline_access openid profile`;
  const device = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, scope }),
  }).then((response) => response.json());

  if (device.error) throw new Error(`${device.error}: ${device.error_description}`);
  console.log(device.message);

  const deadline = Date.now() + Number(device.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Number(device.interval ?? 5) * 1000));
    const token = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: clientId,
        device_code: device.device_code,
      }),
    }).then((response) => response.json());

    if (token.access_token) return token.access_token;
    if (!["authorization_pending", "slow_down"].includes(token.error)) {
      throw new Error(`${token.error}: ${token.error_description}`);
    }
  }
  throw new Error("Device-code sign-in timed out");
}

const accessToken = await requestToken();

async function dv(path) {
  const response = await fetch(`${environment}/api/data/v9.2/${path}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      "odata-version": "4.0",
      "odata-maxversion": "4.0",
      prefer: "odata.include-annotations=*",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  return response.json();
}

const failures = [];
let parentClaimId = "";

for (const table of REQUIRED_TABLES) {
  try {
    const metadata = await dv(`EntityDefinitions(LogicalName='${table.logicalName}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`);
    if (metadata.EntitySetName !== table.entitySetName) failures.push(`${table.logicalName} entity set is ${metadata.EntitySetName}, expected ${table.entitySetName}`);
    if (metadata.PrimaryIdAttribute !== table.primaryIdAttribute) failures.push(`${table.logicalName} primary id is ${metadata.PrimaryIdAttribute}, expected ${table.primaryIdAttribute}`);
    if (metadata.PrimaryNameAttribute !== table.primaryNameAttribute) failures.push(`${table.logicalName} primary name is ${metadata.PrimaryNameAttribute}, expected ${table.primaryNameAttribute}`);

    for (const column of table.requiredColumns) {
      await dv(`EntityDefinitions(LogicalName='${table.logicalName}')/Attributes(LogicalName='${column}')?$select=LogicalName`);
    }

    if (table.parentLookupAttribute) {
      const rels = await dv(
        `EntityDefinitions(LogicalName='${table.logicalName}')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntity,SchemaName&$filter=ReferencedEntity eq 'owcp_claim' and ReferencingAttribute eq '${table.parentLookupAttribute}'`
      );
      if (!Array.isArray(rels.value) || rels.value.length === 0) failures.push(`${table.logicalName} is missing lookup ${table.parentLookupAttribute} to owcp_claim`);
    }

    if (requireOneSample) {
      const rows = await dv(`${table.entitySetName}?$select=${table.primaryIdAttribute}${table.parentLookupAttribute ? `,_${table.parentLookupAttribute}_value` : ""}&$top=2`);
      const values = Array.isArray(rows.value) ? rows.value : [];
      if (values.length !== 1) failures.push(`${table.entitySetName} has ${values.length > 1 ? "more than one" : values.length} sample rows; expected exactly one`);
      if (table.logicalName === "owcp_claim" && values[0]) parentClaimId = values[0][table.primaryIdAttribute];
      if (table.parentLookupAttribute && values[0] && parentClaimId) {
        const lookup = values[0][`_${table.parentLookupAttribute}_value`];
        if (lookup && lookup.toLowerCase() !== parentClaimId.toLowerCase()) failures.push(`${table.entitySetName} sample is not linked to the kept claim`);
      }
    }
  } catch (e) {
    failures.push(`${table.logicalName}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failures.length) {
  console.error(`Dataverse validation failed for ${environment}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dataverse validation passed for ${environment}`);
console.log(`Validated tables: ${REQUIRED_TABLES.map((table) => table.logicalName).join(", ")}`);