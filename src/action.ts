import { debug, getInput, info, setFailed } from "@actions/core";
import createClient from "openapi-fetch";
import type { paths } from "./schema";

const waitTimeSeconds = Number.parseInt(getInput("wait", { required: false }));
const apiKey = getInput("api-key", { required: true });
const coolifyUrl = getInput("coolify-url", { required: false });
const baseUrl = new URL("/api/v1", coolifyUrl).toString();
const coolifyClient = createClient<paths>({
  baseUrl,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
});

let tag: string | undefined = getInput("tag", { required: false });
if (tag === "") {
  tag = undefined;
}

let uuid: string | undefined = getInput("uuid", { required: false });
if (uuid === "") {
  uuid = undefined;
}

const force: boolean = getInput("force", { required: false }) === "true";

if (!tag && !uuid) {
  setFailed("Either tag or uuid must be provided");
  process.exit(1);
}

const deploy = async () => {
  if (tag) debug(`Deploying tag: ${tag}`);
  if (uuid) debug(`Deploying uuid: ${uuid}`);

  const result = await coolifyClient.GET("/deploy", {
    params: { query: { tag, uuid, force } },
  });

  if (!result.data) {
    setFailed(`Failed to deploy: ${result.error.message}`);
    process.exit(1);
  }

  debug(JSON.stringify(result.data));

  return result.data.deployments ?? [];
};

const getDeploymentStatus = async (uuid: string) => {
  const result = await coolifyClient.GET("/deployments/{uuid}", {
    params: { path: { uuid } },
  });

  if (!result.data) {
    setFailed(
      `Failed to get deployment status for deployment '${uuid}': ${result.error.message}`,
    );
    process.exit(1);
  }

  return result.data;
};

void (async () => {
  const deployments = await deploy();

  const deploymentUUIDs = deployments.map(
    (deployment) => deployment.deployment_uuid,
  );

  const status = Object.fromEntries(
    deploymentUUIDs.map((uuid) => [uuid, "queued"]),
  );
  const endTime = Date.now() + waitTimeSeconds * 1000;
  // Pause between updates
  const pause = 5000;

  while (Object.values(status).some((s) => s !== "finished")) {
    if (Date.now() > endTime) {
      setFailed("Timeout reached");
      process.exit(1);
    }

    for (const uuid of Object.keys(status).filter(
      (uuid) => status[uuid] !== "finished" && status[uuid] !== "failed",
    )) {
      const nextStatus = await getDeploymentStatus(uuid);
      if (nextStatus.status !== status[uuid]) {
        info(
          `Deployment ${nextStatus.application_name} (${uuid}) status: ${nextStatus.status}`,
        );
        status[uuid] = nextStatus.status ?? "queued";
      }

      if (status[uuid] === "failed") {
        setFailed(`Deployment ${uuid} failed`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pause));
  }
})();
