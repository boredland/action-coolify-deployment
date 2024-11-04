import { debug, getInput, info, setFailed } from "@actions/core";

const waitTimeSeconds = Number.parseInt(getInput("wait", { required: false }));
const apiKey = getInput("api-key", { required: true });
const coolifyUrl = getInput("coolify-url", { required: false });

let tag: string | undefined = getInput("tag", { required: false });
if (tag === "") {
  tag = undefined;
}

let uuid: string | undefined = getInput("uuid", { required: false });
if (uuid === "") {
  uuid = undefined;
}

let force: string = getInput("force", { required: false });
if (force === "") {
  force = "false";
}

if (!tag && !uuid) {
  setFailed("Either tag or uuid must be provided");
  process.exit(1);
}

const deployPath = `${coolifyUrl}/api/v1/deploy`;
const deploymentPath = (uuid: string) =>
  `${coolifyUrl}/api/v1/deployments/${uuid}`;

const deploy = async () => {
  if (tag) debug(`Deploying tag: ${tag}`);
  if (uuid) debug(`Deploying uuid: ${uuid}`);

  const searchParams = new URLSearchParams({
    ...(tag ? { tag } : {}),
    ...(uuid ? { uuid } : {}),
    force,
  });
  const url = `${deployPath}?${searchParams.toString()}`;

  const result = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!result.ok) {
    setFailed(`Failed to deploy (${result.status}): ${result.statusText}`);
    process.exit(1);
  }

  const response = (await result.json()) as {
    details: {
      resource_uuid: string;
      deployment_uuid: string;
    }[];
    message: string[];
  };

  debug(response.message.join("\n"));

  return response.details;
};

const getDeploymentStatus = async (uuid: string) => {
  const result = await fetch(deploymentPath(uuid), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!result.ok) {
    setFailed(
      `Failed to get deployment status for deployment '${uuid}' (${result.status}): ${result.statusText}`,
    );
    process.exit(1);
  }

  const response = (await result.json()) as {
    status: "in_progress" | "finished" | "queued" | "failed";
  };

  return response.status;
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
  // Pause between attempts
  const pause = 5000;

  while (Object.values(status).some((s) => s !== "finished")) {
    if (Date.now() > endTime) {
      setFailed("Timeout reached");
      process.exit(1);
    }

    for (const uuid of deploymentUUIDs.filter(
      (uuid) => status[uuid] !== "finished" && status[uuid] !== "failed",
    )) {
      const nextStatus = await getDeploymentStatus(uuid);
      if (nextStatus !== status[uuid]) {
        info(`Deployment ${uuid} status: ${nextStatus}`);
        status[uuid] = nextStatus;
      }

      if (status[uuid] === "failed") {
        setFailed(`Deployment ${uuid} failed`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pause));
  }
})();
