import { expect } from "chai";
import { parseEther } from "viem";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import hre from "hardhat";

describe("PlayMoneyToken", function () {
  async function deployFixture() {
    const [owner, addr1] = await hre.viem.getWalletClients();

    const token = await hre.viem.deployContract(
      "PlayMoneyToken",
      [parseEther("1000000")],
      { account: owner.account }
    );

    return { token, owner, addr1 };
  }

  it("Mints initial supply to owner", async function () {
    const { token, owner } = await loadFixture(deployFixture);
    const balance = await token.read.balanceOf([owner.account.address]);
    expect(balance).to.equal(parseEther("1000000"));
  });

  it("Allows owner to mint", async function () {
    const { token, owner, addr1 } = await loadFixture(deployFixture);
    const amount = parseEther("1000");

    await token.write.mint(
      [addr1.account.address, amount],
      { account: owner.account }
    );

    const balance = await token.read.balanceOf([addr1.account.address]);
    expect(balance).to.equal(amount);
  });

  it("Prevents non-owner minting", async function () {
    const { token, addr1 } = await loadFixture(deployFixture);

    await expect(
      token.write.mint(
        [addr1.account.address, parseEther("100")],
        { account: addr1.account }
      )
    ).to.be.rejected;
  });

  it("Transfers tokens between users", async function () {
    const { token, owner, addr1 } = await loadFixture(deployFixture);
    const amount = parseEther("500");

    await token.write.transfer(
      [addr1.account.address, amount],
      { account: owner.account }
    );

    const balance = await token.read.balanceOf([addr1.account.address]);
    expect(balance).to.equal(amount);
  });
});
