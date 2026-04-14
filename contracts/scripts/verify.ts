import { run } from "hardhat";

async function main() {
  const tokenAddress = process.env.BP_TOKEN_ADDRESS;
  const recorderAddress = process.env.BATTLE_REWARD_RECORDER_ADDRESS;

  if (!tokenAddress || !recorderAddress) {
    throw new Error("Missing contract addresses in .env");
  }

  console.log("Verifying BrainPointToken...");
  await run("verify:verify", {
    address: tokenAddress,
    constructorArguments: [process.env.CHAIN_OPERATOR_ADDRESS],
  });

  console.log("Verifying BattleRewardRecorder...");
  await run("verify:verify", {
    address: recorderAddress,
    constructorArguments: [
      process.env.CHAIN_OPERATOR_ADDRESS,
      tokenAddress,
      process.env.CHAIN_OPERATOR_ADDRESS,
    ],
  });

  console.log("Verification done!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});