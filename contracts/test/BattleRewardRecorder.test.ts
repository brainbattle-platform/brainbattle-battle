import { expect } from "chai";
import { ethers } from "hardhat";

describe("BattleRewardRecorder", function () {
  async function deployFixture() {
    const [owner, operator, player1, player2, player3, player4, player5, player6, other] =
      await ethers.getSigners();

    const BrainPointToken = await ethers.getContractFactory("BrainPointToken");
    const token = await BrainPointToken.deploy(owner.address);
    await token.waitForDeployment();

    const BattleRewardRecorder = await ethers.getContractFactory("BattleRewardRecorder");
    const recorder = await BattleRewardRecorder.deploy(
      owner.address,
      await token.getAddress(),
      operator.address
    );
    await recorder.waitForDeployment();

    await token.connect(owner).setMinter(await recorder.getAddress());

    return {
      token,
      recorder,
      owner,
      operator,
      player1,
      player2,
      player3,
      player4,
      player5,
      player6,
      other,
    };
  }

  function rewardItem(rewardType: number, amountBp: number) {
    return { rewardType, amountBp };
  }

  function playerReward(player: string, outcome: number, totalBp: number, breakdown: { rewardType: number; amountBp: number }[]) {
    return {
      player,
      outcome,
      totalBp,
      breakdown,
    };
  }

  it("should record a valid 1v1 battle and mint rewards", async function () {
    const { token, recorder, operator, player1, player2 } = await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_1");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("result-1"));

    const rewards = [
      playerReward(player1.address, 0, 14, [
        rewardItem(0, 2),
        rewardItem(1, 8),
        rewardItem(4, 4),
      ]),
      playerReward(player2.address, 1, 4, [
        rewardItem(0, 2),
        rewardItem(3, 2),
      ]),
    ];

    await expect(
      recorder.connect(operator).recordBattleResult(matchId, 0, resultHash, rewards)
    ).to.emit(recorder, "BattleRecorded");

    expect(await token.balanceOf(player1.address)).to.equal(14);
    expect(await token.balanceOf(player2.address)).to.equal(4);

    const record = await recorder.battleRecords(matchId);
    expect(record.exists).to.equal(true);
    expect(record.matchId).to.equal(matchId);
    expect(record.mode).to.equal(0);
    expect(record.resultHash).to.equal(resultHash);
  });

  it("should record a valid 3v3 battle and mint rewards", async function () {
    const { token, recorder, operator, player1, player2, player3, player4, player5, player6 } =
      await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_3V3");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("result-3v3"));

    const rewards = [
      playerReward(player1.address, 0, 8, [rewardItem(0, 2), rewardItem(1, 6)]),
      playerReward(player2.address, 0, 8, [rewardItem(0, 2), rewardItem(1, 6)]),
      playerReward(player3.address, 0, 8, [rewardItem(0, 2), rewardItem(1, 6)]),
      playerReward(player4.address, 1, 4, [rewardItem(0, 2), rewardItem(3, 2)]),
      playerReward(player5.address, 1, 4, [rewardItem(0, 2), rewardItem(3, 2)]),
      playerReward(player6.address, 1, 4, [rewardItem(0, 2), rewardItem(3, 2)]),
    ];

    await recorder.connect(operator).recordBattleResult(matchId, 1, resultHash, rewards);

    expect(await token.balanceOf(player1.address)).to.equal(8);
    expect(await token.balanceOf(player6.address)).to.equal(4);
  });

  it("should revert when non-operator calls recordBattleResult", async function () {
    const { recorder, other, player1, player2 } = await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_X");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("result-x"));

    const rewards = [
      playerReward(player1.address, 0, 10, [rewardItem(1, 10)]),
      playerReward(player2.address, 1, 2, [rewardItem(3, 2)]),
    ];

    await expect(
      recorder.connect(other).recordBattleResult(matchId, 0, resultHash, rewards)
    ).to.be.revertedWithCustomError(recorder, "NotOperator");
  });

  it("should revert on duplicate matchId", async function () {
    const { recorder, operator, player1, player2 } = await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_DUP");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("dup"));

    const rewards = [
      playerReward(player1.address, 0, 10, [rewardItem(1, 10)]),
      playerReward(player2.address, 1, 2, [rewardItem(3, 2)]),
    ];

    await recorder.connect(operator).recordBattleResult(matchId, 0, resultHash, rewards);

    await expect(
      recorder.connect(operator).recordBattleResult(matchId, 0, resultHash, rewards)
    ).to.be.revertedWithCustomError(recorder, "MatchAlreadyRecorded");
  });

  it("should revert on invalid player count for 1v1", async function () {
    const { recorder, operator, player1, player2, player3 } = await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_BAD_COUNT");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("bad-count"));

    const rewards = [
      playerReward(player1.address, 0, 10, [rewardItem(1, 10)]),
      playerReward(player2.address, 1, 2, [rewardItem(3, 2)]),
      playerReward(player3.address, 1, 2, [rewardItem(3, 2)]),
    ];

    await expect(
      recorder.connect(operator).recordBattleResult(matchId, 0, resultHash, rewards)
    ).to.be.revertedWithCustomError(recorder, "InvalidPlayerCount");
  });

  it("should revert on zero player address", async function () {
    const { recorder, operator, player2 } = await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_ZERO");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("zero"));

    const rewards = [
      playerReward(ethers.ZeroAddress, 0, 10, [rewardItem(1, 10)]),
      playerReward(player2.address, 1, 2, [rewardItem(3, 2)]),
    ];

    await expect(
      recorder.connect(operator).recordBattleResult(matchId, 0, resultHash, rewards)
    ).to.be.revertedWithCustomError(recorder, "InvalidPlayerAddress");
  });

  it("should revert when totalBp does not equal breakdown sum", async function () {
    const { recorder, operator, player1, player2 } = await deployFixture();

    const matchId = ethers.encodeBytes32String("MATCH_BAD_TOTAL");
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("bad-total"));

    const rewards = [
      playerReward(player1.address, 0, 999, [rewardItem(1, 10)]),
      playerReward(player2.address, 1, 2, [rewardItem(3, 2)]),
    ];

    await expect(
      recorder.connect(operator).recordBattleResult(matchId, 0, resultHash, rewards)
    ).to.be.revertedWithCustomError(recorder, "InvalidTotalBp");
  });

    it("owner should update operator", async function () {
    const { recorder, owner, operator, other } = await deployFixture();

    await expect(recorder.connect(owner).setOperator(other.address))
      .to.emit(recorder, "OperatorUpdated")
      .withArgs(operator.address, other.address);

    expect(await recorder.operator()).to.equal(other.address);
  });
});