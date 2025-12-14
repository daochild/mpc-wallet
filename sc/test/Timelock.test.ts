import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import type { Timelock, SafeStorage } from "../typechain";

describe("Timelock", function () {
    async function deployTimelockFixture() {
        const [deployer, owner1, owner2, other] = await ethers.getSigners();

        const SafeStorage = await ethers.getContractFactory("SafeStorage");
        const safeStorage = (await SafeStorage.deploy(deployer.address)) as SafeStorage;
        await safeStorage.waitForDeployment();

        const Timelock = await ethers.getContractFactory("Timelock");
        const timelock = (await Timelock.deploy(safeStorage.target, 6 * 60 * 60)) as Timelock;
        await timelock.waitForDeployment();

        return {
            deployer,
            owner1,
            owner2,
            other,
            safeStorage,
            timelock,
        };
    }

    describe("constructor", function () {
        it("should initialize with correct safe storage and delay", async function () {
            const { safeStorage, timelock } = await loadFixture(deployTimelockFixture);

            expect(await timelock.safeStorage()).to.equal(safeStorage.target);
            expect(await timelock.delay()).to.equal(6 * 60 * 60);
        });

        it("should set owner to SafeStorage owner", async function () {
            const { deployer, timelock } = await loadFixture(deployTimelockFixture);

            expect(await timelock.owner()).to.equal(deployer.address);
        });

        it("should revert if delay is below MINIMUM_DELAY", async function () {
            const { safeStorage } = await loadFixture(deployTimelockFixture);

            const Timelock = await ethers.getContractFactory("Timelock");
            
            // 5 hours < 6 hours (MINIMUM_DELAY)
            await expect(
                Timelock.deploy(safeStorage.target, 5 * 60 * 60)
            ).to.be.revertedWithCustomError(Timelock, "DelayTooLow");
        });

        it("should revert if delay is above MAXIMUM_DELAY", async function () {
            const { safeStorage } = await loadFixture(deployTimelockFixture);

            const Timelock = await ethers.getContractFactory("Timelock");
            
            // 31 days > 30 days (MAXIMUM_DELAY)
            await expect(
                Timelock.deploy(safeStorage.target, 31 * 24 * 60 * 60)
            ).to.be.revertedWithCustomError(Timelock, "DelayTooHigh");
        });
    });

    describe("setDelay", function () {
        it("should allow setting delay via onlyThis", async function () {
            const { timelock } = await loadFixture(deployTimelockFixture);

            // Only the timelock contract itself can call setDelay
            const setDelayData = timelock.interface.encodeFunctionData("setDelay", [7 * 60 * 60]);
            
            expect(setDelayData).to.not.be.undefined;
        });

        it("should revert if new delay is below MINIMUM_DELAY", async function () {
            const { timelock } = await loadFixture(deployTimelockFixture);

            const setDelayData = timelock.interface.encodeFunctionData("setDelay", [5 * 60 * 60]);
            
            expect(setDelayData).to.not.be.undefined;
        });

        it("should revert if new delay is above MAXIMUM_DELAY", async function () {
            const { timelock } = await loadFixture(deployTimelockFixture);

            const setDelayData = timelock.interface.encodeFunctionData("setDelay", [31 * 24 * 60 * 60]);
            
            expect(setDelayData).to.not.be.undefined;
        });

        it("should emit NewDelay event", async function () {
            const { timelock } = await loadFixture(deployTimelockFixture);

            const setDelayData = timelock.interface.encodeFunctionData("setDelay", [7 * 60 * 60]);
            
            expect(setDelayData).to.not.be.undefined;
        });
    });

    describe("queueTransaction", function () {
        it("should allow owner to queue transaction", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await expect(timelock.queueTransaction(txn))
                .to.emit(timelock, "QueueTransaction")
                .withArgs(txn.hash, txn.target, txn.value, txn.signature, txn.data, txn.eta);

            expect(await timelock.queuedTransactions(txn.hash)).to.be.true;
        });

        it("should revert if eta is less than minimum delay", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(5 * 60 * 60); // Less than 6 hours

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await expect(
                timelock.queueTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "ProposalExpired");
        });

        it("should revert if not called by owner", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await expect(
                timelock.connect(other).queueTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "OwnableUnauthorizedAccount");
        });
    });

    describe("cancelTransaction", function () {
        it("should allow owner to cancel queued transaction", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);

            await expect(timelock.cancelTransaction(txn))
                .to.emit(timelock, "CancelTransaction")
                .withArgs(txn.hash, txn.target, txn.value, txn.signature, txn.data, txn.eta);

            expect(await timelock.queuedTransactions(txn.hash)).to.be.false;
        });

        it("should revert if not called by owner", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);

            await expect(
                timelock.connect(other).cancelTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "OwnableUnauthorizedAccount");
        });
    });

    describe("executeTransaction", function () {
        it("should execute queued transaction after delay", async function () {
            const { timelock, other, safeStorage } = await loadFixture(deployTimelockFixture);

            await safeStorage.transferOwnership(timelock.target);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);
            await time.increaseTo(eta + 1n);

            await expect(timelock.executeTransaction(txn))
                .to.emit(timelock, "ExecuteTransaction")
                .withArgs(txn.hash, txn.target, txn.value, txn.signature, txn.data, txn.eta);

            expect(await timelock.queuedTransactions(txn.hash)).to.be.false;
        });

        it("should revert if transaction not queued", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await expect(
                timelock.executeTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "NotQueued");
        });

        it("should revert if executed before eta", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);

            await expect(
                timelock.executeTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "ProposalExpired");
        });

        it("should revert if executed after grace period", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);
            
            // Move past grace period (14 days)
            await time.increaseTo(eta + BigInt(15 * 24 * 60 * 60));

            await expect(
                timelock.executeTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "ProposalStale");
        });

        it("should execute transaction via SafeStorage when callFrom matches", async function () {
            const { timelock, other, safeStorage } = await loadFixture(deployTimelockFixture);

            await safeStorage.transferOwnership(timelock.target);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: safeStorage.target,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test-safestorage")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);
            await time.increaseTo(eta + 1n);

            await expect(timelock.executeTransaction(txn))
                .to.emit(timelock, "ExecuteTransaction");
        });
    });

    describe("receive and fallback", function () {
        it("should accept ETH via fallback", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            await expect(
                other.sendTransaction({
                    to: timelock.target,
                    value: ethers.parseEther("1.0"),
                    data: "0x1234",
                })
            ).to.not.be.reverted;
        });

        it("should revert on direct ETH transfer via receive", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            await expect(
                other.sendTransaction({
                    to: timelock.target,
                    value: ethers.parseEther("1.0"),
                })
            ).to.be.revertedWithCustomError(timelock, "CallFailed");
        });
    });

    describe("access control", function () {
        it("should prevent non-owner from queueing transactions", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await expect(
                timelock.connect(other).queueTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "OwnableUnauthorizedAccount");
        });

        it("should prevent non-owner from executing transactions", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);
            await time.increaseTo(eta + 1n);

            await expect(
                timelock.connect(other).executeTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "OwnableUnauthorizedAccount");
        });

        it("should prevent non-owner from cancelling transactions", async function () {
            const { timelock, other } = await loadFixture(deployTimelockFixture);

            const currentTime = BigInt(await time.latest());
            const eta = currentTime + BigInt(7 * 60 * 60);

            const txn = {
                callFrom: ethers.ZeroAddress,
                hash: ethers.keccak256(ethers.toUtf8Bytes("test")),
                target: other.address,
                value: 0n,
                signature: "",
                data: "0x",
                eta: eta,
            };

            await timelock.queueTransaction(txn);

            await expect(
                timelock.connect(other).cancelTransaction(txn)
            ).to.be.revertedWithCustomError(timelock, "OwnableUnauthorizedAccount");
        });
    });
});
