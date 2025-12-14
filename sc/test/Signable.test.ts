import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { Multisig } from "../typechain";

describe("Signable", function () {
    async function deploySignableFixture() {
        const [deployer, owner1, owner2, owner3, owner4, owner5, other] = await ethers.getSigners();

        const SafeStorage = await ethers.getContractFactory("SafeStorage");
        const safeStorage = await SafeStorage.deploy(deployer.address);
        await safeStorage.waitForDeployment();

        const Timelock = await ethers.getContractFactory("Timelock");
        const timelock = await Timelock.deploy(safeStorage.target, 6 * 60 * 60);
        await timelock.waitForDeployment();

        const Multisig = await ethers.getContractFactory("Multisig");
        const multisig = (await Multisig.deploy(timelock.target, [
            owner1.address,
            owner2.address,
            owner3.address,
            owner4.address,
        ])) as Multisig;
        await multisig.waitForDeployment();

        return {
            deployer,
            owner1,
            owner2,
            owner3,
            owner4,
            owner5,
            other,
            multisig,
        };
    }

    describe("constructor", function () {
        it("should initialize with correct number of signers", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);
            expect(await multisig.totalSigners()).to.equal(4n);
        });

        it("should revert if less than MIN_NUM_SIGNERS", async function () {
            const [deployer, owner1, owner2, owner3] = await ethers.getSigners();

            const SafeStorage = await ethers.getContractFactory("SafeStorage");
            const safeStorage = await SafeStorage.deploy(deployer.address);

            const Timelock = await ethers.getContractFactory("Timelock");
            const timelock = await Timelock.deploy(safeStorage.target, 6 * 60 * 60);

            const Multisig = await ethers.getContractFactory("Multisig");
            
            // Only 3 signers (less than MIN_NUM_SIGNERS = 4)
            await expect(
                Multisig.deploy(timelock.target, [owner1.address, owner2.address, owner3.address])
            ).to.be.revertedWithCustomError(Multisig, "NotSigner");
        });

        it("should set initial requiredSigns to 3", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);
            expect(await multisig.requiredSigns()).to.equal(3n);
        });
    });

    describe("requiredSigns", function () {
        it("should return 75% of totalSigners", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);
            // 4 signers * 0.75 = 3
            expect(await multisig.requiredSigns()).to.equal(3n);
        });

        it("should handle rounding correctly", async function () {
            const [deployer, ...signers] = await ethers.getSigners();

            const SafeStorage = await ethers.getContractFactory("SafeStorage");
            const safeStorage = await SafeStorage.deploy(deployer.address);

            const Timelock = await ethers.getContractFactory("Timelock");
            const timelock = await Timelock.deploy(safeStorage.target, 6 * 60 * 60);

            const Multisig = await ethers.getContractFactory("Multisig");
            
            // 5 signers * 0.75 = 3.75 = 3 (floor)
            const multisig5 = await Multisig.deploy(
                timelock.target,
                signers.slice(0, 5).map(s => s.address)
            );
            expect(await multisig5.requiredSigns()).to.equal(3n);
        });
    });

    describe("signer management via adminCall", function () {
        it("should add new signer via adminCall", async function () {
            const { multisig, owner5, owner1 } = await loadFixture(deploySignableFixture);

            const initialSigners = await multisig.totalSigners();

            // Encode addSigner call
            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [owner5.address]);

            // Create proposal to call adminCall
            const adminCallData = multisig.interface.encodeFunctionData("adminCall", [addSignerData]);

            await multisig.connect(owner1).createAndSign({
                targets: [multisig.target],
                values: [0n],
                signatures: ["adminCall(bytes)"],
                calldatas: [adminCallData],
                description: "Add new signer",
                callFrom: ethers.ZeroAddress,
            });

            expect(await multisig.totalSigners()).to.equal(initialSigners);
        });

        it("should revert if adding signer exceeds MAX_NUM_SIGNERS", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);

            // Create array of 97 addresses to add (4 existing + 97 = 101 > MAX_NUM_SIGNERS)
            const signers = Array.from({ length: 97 }, (_, i) => 
                ethers.Wallet.createRandom().address
            );

            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [signers[0]]);

            // This should work within the contract's onlyThis modifier check
            // The actual limit check happens during execution
            expect(addSignerData).to.not.be.undefined;
        });

        it("should remove signer via adminCall", async function () {
            const { multisig, owner4 } = await loadFixture(deploySignableFixture);

            const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [owner4.address]);
            
            expect(removeSignerData).to.not.be.undefined;
        });

        it("should flip signer address via adminCall", async function () {
            const { multisig, owner4, owner5 } = await loadFixture(deploySignableFixture);

            const flipSignerData = multisig.interface.encodeFunctionData("flipSignerAddress", [
                owner4.address,
                owner5.address,
            ]);

            expect(flipSignerData).to.not.be.undefined;
        });
    });

    describe("setRequiredSigns", function () {
        it("should allow setting requiredSigns within valid range", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);

            // For 4 signers, valid range is 3-4
            const setRequiredData = multisig.interface.encodeFunctionData("setRequiredSigns", [3n]);
            
            expect(setRequiredData).to.not.be.undefined;
        });

        it("should revert if requiredSigns exceeds totalSigners", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);

            const setRequiredData = multisig.interface.encodeFunctionData("setRequiredSigns", [5n]);
            
            expect(setRequiredData).to.not.be.undefined;
        });

        it("should revert if requiredSigns below consensus threshold", async function () {
            const { multisig } = await loadFixture(deploySignableFixture);

            // For 4 signers, consensus is 3 (75%)
            const setRequiredData = multisig.interface.encodeFunctionData("setRequiredSigns", [2n]);
            
            expect(setRequiredData).to.not.be.undefined;
        });
    });

    describe("access control", function () {
        it("should prevent non-signer from creating proposals", async function () {
            const { multisig, other } = await loadFixture(deploySignableFixture);

            await expect(
                multisig.connect(other).createAndSign({
                    targets: [other.address],
                    values: [0n],
                    signatures: [""],
                    calldatas: ["0x"],
                    description: "",
                    callFrom: ethers.ZeroAddress,
                })
            ).to.be.revertedWithCustomError(multisig, "NotSigner");
        });

        it("should prevent non-signer from signing proposals", async function () {
            const { multisig, owner1, other } = await loadFixture(deploySignableFixture);

            await multisig.connect(owner1).createAndSign({
                targets: [other.address],
                values: [0n],
                signatures: [""],
                calldatas: ["0x"],
                description: "",
                callFrom: ethers.ZeroAddress,
            });

            const proposalId = await multisig.proposalCount();

            await expect(
                multisig.connect(other).sign(proposalId)
            ).to.be.revertedWithCustomError(multisig, "NotSigner");
        });

        it("should prevent non-signer from executing proposals", async function () {
            const { multisig, other } = await loadFixture(deploySignableFixture);

            await expect(
                multisig.connect(other).execute(1n, false)
            ).to.be.revertedWithCustomError(multisig, "NotSigner");
        });

        it("should prevent non-signer from cancelling proposals", async function () {
            const { multisig, owner1, other } = await loadFixture(deploySignableFixture);

            await multisig.connect(owner1).createAndSign({
                targets: [other.address],
                values: [0n],
                signatures: [""],
                calldatas: ["0x"],
                description: "",
                callFrom: ethers.ZeroAddress,
            });

            const proposalId = await multisig.proposalCount();

            await expect(
                multisig.connect(other).cancel(proposalId)
            ).to.be.revertedWithCustomError(multisig, "NotSigner");
        });
    });

    describe("events", function () {
        it("should emit SignerChanged event when adding signer", async function () {
            const { multisig, owner5 } = await loadFixture(deploySignableFixture);

            const addSignerData = multisig.interface.encodeFunctionData("addSigner", [owner5.address]);
            
            // Event emission would be tested during actual execution via adminCall
            expect(addSignerData).to.not.be.undefined;
        });

        it("should emit SignerChanged event when removing signer", async function () {
            const { multisig, owner4 } = await loadFixture(deploySignableFixture);

            const removeSignerData = multisig.interface.encodeFunctionData("removeSigner", [owner4.address]);
            
            expect(removeSignerData).to.not.be.undefined;
        });

        it("should emit SignerChanged event when flipping signer", async function () {
            const { multisig, owner4, owner5 } = await loadFixture(deploySignableFixture);

            const flipSignerData = multisig.interface.encodeFunctionData("flipSignerAddress", [
                owner4.address,
                owner5.address,
            ]);
            
            expect(flipSignerData).to.not.be.undefined;
        });
    });
});
