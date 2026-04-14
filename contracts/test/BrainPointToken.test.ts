import { expect } from "chai";
import { ethers } from "hardhat";

describe("BrainPointToken", function () {
  async function deployFixture() {
    const [owner, minter, user, other] = await ethers.getSigners();

    const BrainPointToken = await ethers.getContractFactory("BrainPointToken");
    const token = await BrainPointToken.deploy(owner.address);
    await token.waitForDeployment();

    return { token, owner, minter, user, other };
  }

  it("should deploy with correct name, symbol, decimals", async function () {
    const { token } = await deployFixture();

    expect(await token.name()).to.equal("BrainPoint");
    expect(await token.symbol()).to.equal("BP");
    expect(await token.decimals()).to.equal(0);
  });

  it("should let owner set minter", async function () {
    const { token, owner, minter } = await deployFixture();

    await expect(token.connect(owner).setMinter(minter.address))
      .to.emit(token, "MinterUpdated")
      .withArgs(ethers.ZeroAddress, minter.address);

    expect(await token.minter()).to.equal(minter.address);
  });

  it("should revert when non-owner sets minter", async function () {
    const { token, minter, user } = await deployFixture();

    await expect(token.connect(user).setMinter(minter.address)).to.be.reverted;
  });

  it("should revert when setting zero address as minter", async function () {
    const { token, owner } = await deployFixture();

    await expect(token.connect(owner).setMinter(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(token, "InvalidMinter");
  });

  it("should let minter mint tokens", async function () {
    const { token, owner, minter, user } = await deployFixture();

    await token.connect(owner).setMinter(minter.address);

    await expect(token.connect(minter).mint(user.address, 15))
      .to.changeTokenBalance(token, user, 15);

    expect(await token.balanceOf(user.address)).to.equal(15);
  });

  it("should revert when non-minter tries to mint", async function () {
    const { token, owner, minter, user, other } = await deployFixture();

    await token.connect(owner).setMinter(minter.address);

    await expect(token.connect(other).mint(user.address, 10))
      .to.be.revertedWithCustomError(token, "NotMinter");
  });
});