import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RWA Architecture", function () {
  let admin: HardhatEthersSigner;
  let buyer: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let kycRegistry: any;
  let assetToken: any;
  let escrow: any;

  beforeEach(async function () {
    [admin, buyer, seller] = await ethers.getSigners();

    // 1. Deploy KycRegistry
    const KycRegistry = await ethers.getContractFactory("KycRegistry");
    kycRegistry = await KycRegistry.deploy();
    await kycRegistry.waitForDeployment();

    // 2. Deploy AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    const totalSupply = ethers.parseUnits("1000", 18);
    assetToken = await AssetToken.deploy(
      "Real Estate Token",
      "RET",
      totalSupply,
      admin.address,
      100,
      0,
      await kycRegistry.getAddress()
    );
    await assetToken.waitForDeployment();

    // 3. Deploy EscrowMarketplace
    const EscrowMarketplace = await ethers.getContractFactory("EscrowMarketplace");
    escrow = await EscrowMarketplace.deploy();
    await escrow.waitForDeployment();
  });

  describe("KYC Compliance", function () {
    it("should revert transfer if receiver is not whitelisted", async function () {
      const amount = ethers.parseUnits("100", 18);
      await expect(assetToken.transfer(buyer.address, amount)).to.be.revertedWith(
        "Receiver is not KYC whitelisted"
      );
    });

    it("should allow transfer if receiver is whitelisted", async function () {
      await kycRegistry.updateKycStatus(buyer.address, true);
      const amount = ethers.parseUnits("100", 18);
      
      await expect(assetToken.transfer(buyer.address, amount))
        .to.emit(assetToken, "Transfer")
        .withArgs(admin.address, buyer.address, amount);
      
      expect(await assetToken.balanceOf(buyer.address)).to.equal(amount);
    });
  });

  describe("Settlement with Permits", function () {
    beforeEach(async function () {
      // Whitelist both buyer and seller
      await kycRegistry.updateKycStatus(buyer.address, true);
      await kycRegistry.updateKycStatus(seller.address, true);

      // Give seller some tokens
      const amount = ethers.parseUnits("100", 18);
      await assetToken.transfer(seller.address, amount);
    });

    it("should settle batch trades using EIP-2612 permits without prior approve", async function () {
      const amountToSell = ethers.parseUnits("50", 18);
      
      // Seller signs a permit for EscrowMarketplace
      const nonce = await assetToken.nonces(seller.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour valid
      
      const domain = {
        name: "Real Estate Token",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await assetToken.getAddress()
      };
      
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };
      
      const values = {
        owner: seller.address,
        spender: await escrow.getAddress(),
        value: amountToSell,
        nonce,
        deadline
      };
      
      const signature = await seller.signTypedData(domain, types, values);
      const sig = ethers.Signature.from(signature);

      // Admin calls batchSettleWithPermits
      await expect(
        escrow.batchSettleWithPermits(
          await assetToken.getAddress(),
          [seller.address],
          [buyer.address],
          [amountToSell],
          [deadline],
          [sig.v],
          [sig.r],
          [sig.s]
        )
      ).to.emit(escrow, "BatchSettled").withArgs(await assetToken.getAddress(), 1);

      expect(await assetToken.balanceOf(buyer.address)).to.equal(amountToSell);
      expect(await assetToken.balanceOf(seller.address)).to.equal(ethers.parseUnits("50", 18));
    });
  });
});
