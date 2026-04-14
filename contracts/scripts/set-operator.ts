import { ethers, network } from "hardhat";

async function main() {
  const recorderAddress = process.env.BATTLE_REWARD_RECORDER_ADDRESS;

  if (!recorderAddress) {
    throw new Error("Missing BATTLE_REWARD_RECORDER_ADDRESS in .env");
  }

  const [owner, newOperator] = await ethers.getSigners();

  console.log("====================================");
  console.log("Set Operator Script");
  console.log("====================================");
  console.log(`Network          : ${network.name}`);
  console.log(`Recorder address : ${recorderAddress}`);
  console.log(`Owner            : ${owner.address}`);
  console.log(`New operator     : ${newOperator.address}`);
  console.log("");

  const recorder = await ethers.getContractAt(
    "BattleRewardRecorder",
    recorderAddress
  );

  const currentOperator = await recorder.operator();
  console.log(`Current operator : ${currentOperator}`);

  console.log("Updating operator...");
  const tx = await recorder.connect(owner).setOperator(newOperator.address);
  await tx.wait();

  const updatedOperator = await recorder.operator();

  console.log("");
  console.log("====================================");
  console.log("Result");
  console.log("====================================");
  console.log(`Updated operator : ${updatedOperator}`);
  console.log(`Tx hash          : ${tx.hash}`);
}

main().catch((error) => {
  console.error("Set operator failed:");
  console.error(error);
  process.exitCode = 1;
});