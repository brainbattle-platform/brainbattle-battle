import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function upsertEnv(envPath: string, updates: Record<string, string>) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    const regex = new RegExp(`^${key}=.*$`, "m");

    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, content.trim() + "\n");
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("====================================");
  console.log("BrainBattle Contracts Deployment");
  console.log("====================================");
  console.log(`Network           : ${network.name}`);
  console.log(`Deployer address  : ${deployer.address}`);

  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance  : ${ethers.formatEther(deployerBalance)} ETH\n`);

  console.log("1) Deploying BrainPointToken...");
  const BrainPointToken = await ethers.getContractFactory("BrainPointToken");
  const brainPointToken = await BrainPointToken.deploy(deployer.address);
  await brainPointToken.waitForDeployment();

  const tokenAddress = await brainPointToken.getAddress();
  console.log(`   BrainPointToken deployed at: ${tokenAddress}\n`);

  console.log("2) Deploying BattleRewardRecorder...");
  const BattleRewardRecorder = await ethers.getContractFactory("BattleRewardRecorder");
  const battleRewardRecorder = await BattleRewardRecorder.deploy(
    deployer.address,
    tokenAddress,
    deployer.address,
  );
  await battleRewardRecorder.waitForDeployment();

  const recorderAddress = await battleRewardRecorder.getAddress();
  console.log(`   BattleRewardRecorder deployed at: ${recorderAddress}\n`);

  console.log("3) Setting recorder as token minter...");
  const setMinterTx = await brainPointToken.setMinter(recorderAddress);
  await setMinterTx.wait();
  console.log("   Recorder has been set as minter.\n");

  const currentMinter = await brainPointToken.minter();
  const currentOperator = await battleRewardRecorder.operator();

  console.log("====================================");
  console.log("Deployment Summary");
  console.log("====================================");
  console.log(`BrainPointToken          : ${tokenAddress}`);
  console.log(`BattleRewardRecorder     : ${recorderAddress}`);
  console.log(`Token minter             : ${currentMinter}`);
  console.log(`Recorder operator        : ${currentOperator}\n`);

  const backendEnvPath = path.resolve(__dirname, "../../.env");

  upsertEnv(backendEnvPath, {
    BLOCKCHAIN_ENABLED: "true",
    RPC_URL: "http://127.0.0.1:8545",
    PRIVATE_KEY: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    CONTRACT_ADDRESS: recorderAddress,
    CHAIN_ID: "31337",
    BP_TOKEN_ADDRESS: tokenAddress,
    BATTLE_REWARD_RECORDER_ADDRESS: recorderAddress,
    CHAIN_OPERATOR_ADDRESS: currentOperator,
  });

  console.log(`Backend .env synced: ${backendEnvPath}`);
}

main().catch((error) => {
  console.error("Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});