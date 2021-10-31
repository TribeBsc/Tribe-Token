import { Tribe__factory } from "../typechain/factories/Tribe__factory";
import { ethers, upgrades, network, run } from "hardhat";

import {
  DeploymentData,
  DeploymentOutput,
  deploymentsFolder,
  getDeploymentData,
  getLogger,
  writeDeploymentData,
} from "../utilities";

import * as fs from "fs";

import {
  hashBytecodeWithoutMetadata,
  Manifest,
} from "@openzeppelin/upgrades-core";
import { Contract } from "ethers";
const logger = getLogger("scripts::deploy-tribe");

interface DeployedContract {
  isUpgradable: boolean;
  instance: Contract;
  version: string;
  date: string;
}

interface UpgradableDeployedContract extends DeployedContract {
  implementationAddress: string;
}

async function main() {
  await run("compile");
  const accounts = await ethers.getSigners();
  const deploymentAccount = accounts[0];

  logger.debug(`Deploying to ${network.name}`);

  logger.debug(
    `'${deploymentAccount.address}' will be used as the deployment account`
  );

  const tribefactory = new Tribe__factory(deploymentAccount);

  const bytecodeHash = hashBytecodeWithoutMetadata(tribefactory.bytecode);

  logger.debug(`Implementation version is ${bytecodeHash}`);

  const instance = await tribefactory.deploy();

  await instance.deployed();

  logger.debug(`Deployed contract to ${instance.address}`);

  const deploymentData: UpgradableDeployedContract = {
    isUpgradable: true,
    instance,
    implementationAddress: instance.address,
    version: bytecodeHash,
    date: new Date().toISOString(),
  };

  logger.debug(`Saving deployment data...`);
  await saveDeploymentData(
    "tribe",
    deploymentData,
    {
    },
    "tribe-token-prod"
  );

  if (deploymentData.implementationAddress) {
    logger.debug(`Waiting for 5 confirmations`);
    await instance.deployTransaction.wait(5);

    logger.debug(`Attempting to verify implementation contract with bscscan`);
    try {
      await run("verify:verify", {
        address: deploymentData.implementationAddress,
        constructorArguments: [],
      });
    } catch (e) {
      logger.error(`Failed to verify contract: ${e}`);
    }
  }
}

const saveDeploymentData = async (
  type: string,
  deployment: DeployedContract | UpgradableDeployedContract,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: { [key: string]: any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tag?: string
) => {
  let deploymentData: DeploymentOutput = {};

  try {
    const existingData = getDeploymentData(network.name);
    deploymentData = existingData;
  } catch (e) {
    // create folder
    logger.debug(`no existing deployments found, creating folder`);
    fs.mkdirSync(deploymentsFolder, { recursive: true });
  }

  if (!deploymentData[type]) {
    deploymentData[type] = [];
  }

  const deployments = deploymentData[type];

  let implementation: string | undefined;

  // extract extra data if this is an upgradable contract
  if (deployment.isUpgradable) {
    const upgradableDeployment = deployment as UpgradableDeployedContract;
    implementation = upgradableDeployment.implementationAddress;
  }

  const finalTag = tag || "untagged";

  checkUniqueTag(finalTag, deployments);

  logger.debug(`Registering new deployment of ${type} with tag '${finalTag}'`);
  const deploymentInstance: DeploymentData = {
    tag,
    address: deployment.instance.address,
    version: deployment.version,
    date: deployment.date,
    args,
    isUpgradable: deployment.isUpgradable,
    implementation,
  };

  deployments.push(deploymentInstance);

  writeDeploymentData(network.name, deploymentData);
  logger.debug(`Updated ${network.name} deployment file.`);
};

const checkUniqueTag = (tag: string, deployments: DeploymentData[]) => {
  const numMatches = deployments.filter((d) => {
    if (!d.tag) {
      return false;
    }
    return d.tag.toLowerCase() === tag.toLowerCase();
  }).length;

  logger.warn(
    `There are ${numMatches} deployments with the same tag of ${tag}`
  );
};

main();
