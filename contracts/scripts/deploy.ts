import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("====================================");
  console.log("BrainBattle Contracts Deployment");
  console.log("====================================");
  console.log(`Network           : ${network.name}`);
  console.log(`Deployer address  : ${deployer.address}`);

  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance  : ${ethers.formatEther(deployerBalance)} ETH`);
  console.log("");

  console.log("1) Deploying BrainPointToken...");
  const BrainPointToken = await ethers.getContractFactory("BrainPointToken");
  const brainPointToken = await BrainPointToken.deploy(deployer.address);
  await brainPointToken.waitForDeployment();

  const tokenAddress = await brainPointToken.getAddress();
  console.log(`   BrainPointToken deployed at: ${tokenAddress}`);
  console.log("");

  console.log("2) Deploying BattleRewardRecorder...");
  const BattleRewardRecorder = await ethers.getContractFactory("BattleRewardRecorder");
  const battleRewardRecorder = await BattleRewardRecorder.deploy(
    deployer.address,   // initialOwner
    tokenAddress,       // tokenAddress
    deployer.address    // initialOperator
  );
  await battleRewardRecorder.waitForDeployment();

  const recorderAddress = await battleRewardRecorder.getAddress();
  console.log(`   BattleRewardRecorder deployed at: ${recorderAddress}`);
  console.log("");

  console.log("3) Setting recorder as token minter...");
  const setMinterTx = await brainPointToken.setMinter(recorderAddress);
  await setMinterTx.wait();
  console.log("   Recorder has been set as minter.");
  console.log("");

  const currentMinter = await brainPointToken.minter();
  const currentOperator = await battleRewardRecorder.operator();

  console.log("====================================");
  console.log("Deployment Summary");
  console.log("====================================");
  console.log(`BrainPointToken          : ${tokenAddress}`);
  console.log(`BattleRewardRecorder     : ${recorderAddress}`);
  console.log(`Token minter             : ${currentMinter}`);
  console.log(`Recorder operator        : ${currentOperator}`);
  console.log("");

  console.log("Copy these into backend .env later:");
  console.log(`BP_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`BATTLE_REWARD_RECORDER_ADDRESS=${recorderAddress}`);
  console.log(`CHAIN_OPERATOR_ADDRESS=${currentOperator}`);
  console.log("");

  if (network.name !== "hardhat") {
    console.log("Optional next step:");
    console.log("Run verify script after explorer index catches up.");
  }
}

main().catch((error) => {
  console.error("Deployment failed:");
  console.error(error);
  process.exitCode = 1;
});