import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SafeStorage } from "../typechain";

describe("SafeStorage", function () {
    async function deploySafeStorageFixture() {
        const [deployer, owner, other] = await ethers.getSigners();

        const SafeStorage = await ethers.getContractFactory("SafeStorage");
        const safeStorage = (await SafeStorage.deploy(deployer.address)) as SafeStorage;
        await safeStorage.waitForDeployment();

        return {
            deployer,
            owner,
            other,
            safeStorage,
        };
    }

    describe("constructor", function () {
        it("should set the correct owner", async function () {
            const { deployer, safeStorage } = await loadFixture(deploySafeStorageFixture);
            expect(await safeStorage.owner()).to.equal(deployer.address);
        });
    });

    describe("receive", function () {
        it("should accept ETH transfers", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const amount = ethers.parseEther("1.0");

            await expect(
                other.sendTransaction({
                    to: safeStorage.target,
                    value: amount,
                })
            ).to.changeEtherBalance(safeStorage, amount);
        });

        it("should emit Received event on ETH transfer", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const amount = ethers.parseEther("1.0");

            await expect(
                other.sendTransaction({
                    to: safeStorage.target,
                    value: amount,
                })
            ).to.emit(safeStorage, "Received")
             .withArgs(other.address, amount);
        });

        it("should not emit event for zero value transfer", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            await expect(
                other.sendTransaction({
                    to: safeStorage.target,
                    value: 0n,
                })
            ).to.not.emit(safeStorage, "Received");
        });
    });

    describe("fallback", function () {
        it("should accept ETH with data", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const amount = ethers.parseEther("1.0");

            await expect(
                other.sendTransaction({
                    to: safeStorage.target,
                    value: amount,
                    data: "0x1234",
                })
            ).to.changeEtherBalance(safeStorage, amount);
        });

        it("should emit ReceivedFallback event on ETH transfer with data", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const amount = ethers.parseEther("1.0");

            await expect(
                other.sendTransaction({
                    to: safeStorage.target,
                    value: amount,
                    data: "0x1234",
                })
            ).to.emit(safeStorage, "ReceivedFallback")
             .withArgs(other.address, amount);
        });
    });

    describe("execute", function () {
        it("should allow owner to execute calls", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            // Fund safeStorage
            await other.sendTransaction({
                to: safeStorage.target,
                value: ethers.parseEther("2.0"),
            });

            const initialBalance = await ethers.provider.getBalance(other.address);

            await safeStorage.execute({
                target: other.address,
                value: ethers.parseEther("1.0"),
                data: "0x",
            });

            const finalBalance = await ethers.provider.getBalance(other.address);
            expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1.0"));
        });

        it("should revert if insufficient balance", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            await expect(
                safeStorage.execute({
                    target: other.address,
                    value: ethers.parseEther("1.0"),
                    data: "0x",
                })
            ).to.be.revertedWithCustomError(safeStorage, "InsufficientBalance");
        });

        it("should allow adding msg.value to cover execution", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const initialBalance = await ethers.provider.getBalance(other.address);

            await safeStorage.execute(
                {
                    target: other.address,
                    value: ethers.parseEther("1.0"),
                    data: "0x",
                },
                { value: ethers.parseEther("1.0") }
            );

            const finalBalance = await ethers.provider.getBalance(other.address);
            expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1.0"));
        });

        it("should execute contract calls with calldata", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            // Deploy a simple ERC20 mock
            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const token = await ERC20Mock.deploy();
            await token.waitForDeployment();

            // Mint tokens to safeStorage
            await token.mint(safeStorage.target, ethers.parseUnits("100", 18));

            // Prepare transfer call
            const transferData = token.interface.encodeFunctionData("transfer", [
                other.address,
                ethers.parseUnits("50", 18),
            ]);

            await safeStorage.execute({
                target: token.target,
                value: 0n,
                data: transferData,
            });

            expect(await token.balanceOf(other.address)).to.equal(ethers.parseUnits("50", 18));
        });

        it("should revert if called by non-owner", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            await expect(
                safeStorage.connect(other).execute({
                    target: other.address,
                    value: 0n,
                    data: "0x",
                })
            ).to.be.revertedWithCustomError(safeStorage, "OwnableUnauthorizedAccount");
        });

        it("should bubble up revert reasons from failed calls", async function () {
            const { safeStorage } = await loadFixture(deploySafeStorageFixture);

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const token = await ERC20Mock.deploy();
            await token.waitForDeployment();

            // Try to transfer without balance
            const transferData = token.interface.encodeFunctionData("transfer", [
                safeStorage.target,
                ethers.parseUnits("100", 18),
            ]);

            await expect(
                safeStorage.execute({
                    target: token.target,
                    value: 0n,
                    data: transferData,
                })
            ).to.be.reverted;
        });
    });

    describe("ERC721 support", function () {
        it("should accept ERC721 tokens", async function () {
            const { safeStorage } = await loadFixture(deploySafeStorageFixture);

            const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
            const nft = await ERC721Mock.deploy();
            await nft.waitForDeployment();

            await nft.mint(safeStorage.target, 1n);

            expect(await nft.balanceOf(safeStorage.target)).to.equal(1n);
            expect(await nft.ownerOf(1n)).to.equal(safeStorage.target);
        });

        it("should transfer ERC721 tokens via execute", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
            const nft = await ERC721Mock.deploy();
            await nft.waitForDeployment();

            await nft.mint(safeStorage.target, 1n);

            const transferData = nft.interface.encodeFunctionData("transferFrom", [
                safeStorage.target,
                other.address,
                1n,
            ]);

            await safeStorage.execute({
                target: nft.target,
                value: 0n,
                data: transferData,
            });

            expect(await nft.ownerOf(1n)).to.equal(other.address);
        });
    });

    describe("ERC1155 support", function () {
        it("should accept ERC1155 tokens", async function () {
            const { safeStorage } = await loadFixture(deploySafeStorageFixture);

            const ERC1155Mock = await ethers.getContractFactory("ERC1155Mock");
            const nft = await ERC1155Mock.deploy();
            await nft.waitForDeployment();

            await nft.mint(safeStorage.target, 1n, 100n, "0x");

            expect(await nft.balanceOf(safeStorage.target, 1n)).to.equal(100n);
        });

        it("should transfer ERC1155 tokens via execute", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            const ERC1155Mock = await ethers.getContractFactory("ERC1155Mock");
            const nft = await ERC1155Mock.deploy();
            await nft.waitForDeployment();

            await nft.mint(safeStorage.target, 1n, 100n, "0x");

            const transferData = nft.interface.encodeFunctionData("safeTransferFrom", [
                safeStorage.target,
                other.address,
                1n,
                50n,
                "0x",
            ]);

            await safeStorage.execute({
                target: nft.target,
                value: 0n,
                data: transferData,
            });

            expect(await nft.balanceOf(other.address, 1n)).to.equal(50n);
            expect(await nft.balanceOf(safeStorage.target, 1n)).to.equal(50n);
        });
    });

    describe("ownership", function () {
        it("should allow owner to transfer ownership", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            await safeStorage.transferOwnership(other.address);

            expect(await safeStorage.owner()).to.equal(other.address);
        });

        it("should prevent non-owner from transferring ownership", async function () {
            const { safeStorage, other } = await loadFixture(deploySafeStorageFixture);

            await expect(
                safeStorage.connect(other).transferOwnership(other.address)
            ).to.be.revertedWithCustomError(safeStorage, "OwnableUnauthorizedAccount");
        });
    });
});
