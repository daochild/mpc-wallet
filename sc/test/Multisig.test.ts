import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployCoreFixture, buildSingleActionProposal, createProposal, queueProposal, buildProposalInput } from "./fixtures/core";
import { status } from "./helpers/proposals";

describe("Multisig - Proposal Management", function () {
    describe("multi-action proposals", function () {
        it("should create proposal with multiple actions", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const token1 = await ERC20Mock.deploy();
            const token2 = await ERC20Mock.deploy();
            await token1.waitForDeployment();
            await token2.waitForDeployment();

            await token1.mint(fixture.safeStorage.target, 100n);
            await token2.mint(fixture.safeStorage.target, 200n);

            const proposal = buildProposalInput({
                targets: [token1.target, token2.target] as string[],
                values: [0n, 0n],
                signatures: ["transfer(address,uint256)", "transfer(address,uint256)"],
                calldatas: [
                    token1.interface.encodeFunctionData("transfer", [fixture.other.address, 50n]),
                    token2.interface.encodeFunctionData("transfer", [fixture.other.address, 100n]),
                ],
                description: "Transfer multiple tokens",
                callFrom: fixture.safeStorage.target,
            });

            await fixture.multisig.connect(fixture.owner1).createAndSign(proposal);
            const proposalId = await fixture.multisig.proposalCount();

            expect(proposalId).to.equal(1n);

            const actions = await fixture.multisig.getActions(proposalId);
            expect(actions.targets.length).to.equal(2);
            expect(actions.targets[0]).to.equal(token1.target);
            expect(actions.targets[1]).to.equal(token2.target);
        });

        it("should execute multiple actions in order", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const token1 = await ERC20Mock.deploy();
            const token2 = await ERC20Mock.deploy();
            await token1.waitForDeployment();
            await token2.waitForDeployment();

            await token1.mint(fixture.safeStorage.target, 100n);
            await token2.mint(fixture.safeStorage.target, 200n);

            const proposal = buildProposalInput({
                targets: [token1.target, token2.target] as string[],
                values: [0n, 0n],
                signatures: ["transfer(address,uint256)", "transfer(address,uint256)"],
                calldatas: [
                    token1.interface.encodeFunctionData("transfer", [fixture.other.address, 50n]),
                    token2.interface.encodeFunctionData("transfer", [fixture.other.address, 100n]),
                ],
                description: "Transfer multiple tokens",
                callFrom: fixture.safeStorage.target,
            });

            const proposalId = await createProposal(fixture.multisig, fixture.owner1, proposal);
            const eta = await queueProposal(fixture.multisig, [fixture.owner2, fixture.owner3], proposalId);

            await time.increaseTo(eta + 1n);
            await fixture.multisig.connect(fixture.owner1).execute(proposalId, false);

            expect(await token1.balanceOf(fixture.other.address)).to.equal(50n);
            expect(await token2.balanceOf(fixture.other.address)).to.equal(100n);
        });

        it("should handle mixed ETH and ERC20 transfers", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            // Fund safeStorage with ETH
            await fixture.owner1.sendTransaction({
                to: fixture.safeStorage.target,
                value: ethers.parseEther("2.0"),
            });

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const token = await ERC20Mock.deploy();
            await token.waitForDeployment();
            await token.mint(fixture.safeStorage.target, 100n);

            const proposal = buildProposalInput({
                targets: [fixture.other.address, token.target] as string[],
                values: [ethers.parseEther("1.0"), 0n],
                signatures: ["", "transfer(address,uint256)"],
                calldatas: [
                    "0x",
                    token.interface.encodeFunctionData("transfer", [fixture.other.address, 50n]),
                ],
                description: "Mixed transfer",
                callFrom: fixture.safeStorage.target,
            });

            const proposalId = await createProposal(fixture.multisig, fixture.owner1, proposal);
            const eta = await queueProposal(fixture.multisig, [fixture.owner2, fixture.owner3], proposalId);

            await time.increaseTo(eta + 1n);
            
            const initialEthBalance = await ethers.provider.getBalance(fixture.other.address);
            // Pass value for ETH transfer in the proposal
            await fixture.multisig.connect(fixture.owner1).execute(proposalId, false, { value: ethers.parseEther("1.0") });
            const finalEthBalance = await ethers.provider.getBalance(fixture.other.address);

            expect(finalEthBalance - initialEthBalance).to.equal(ethers.parseEther("1.0"));
            expect(await token.balanceOf(fixture.other.address)).to.equal(50n);
        });
    });

    describe("edge cases", function () {
        it("should handle zero-value transfers", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    value: 0n,
                    callFrom: fixture.safeStorage.target,
                })
            );

            expect(proposalId).to.equal(1n);
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.INITIALIZED));
        });

        it("should handle proposal with empty calldata", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    value: 0n,
                    calldata: "0x",
                    callFrom: fixture.safeStorage.target,
                })
            );

            expect(proposalId).to.equal(1n);
        });

        it("should validate array length mismatches", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            await expect(
                fixture.multisig.connect(fixture.owner1).createAndSign({
                    targets: [fixture.other.address, fixture.other.address],
                    values: [0n], // Mismatch: 2 targets, 1 value
                    signatures: ["", ""],
                    calldatas: ["0x", "0x"],
                    description: "",
                    callFrom: fixture.safeStorage.target,
                })
            ).to.be.revertedWithCustomError(fixture.multisig, "ArrayLengthMismatch");
        });

        it("should handle proposal with description", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    value: 0n,
                    description: "Test proposal with description",
                    callFrom: fixture.safeStorage.target,
                })
            );

            const proposal = await fixture.multisig.proposals(proposalId);
            expect(proposal.description).to.equal("Test proposal with description");
        });
    });

    describe("proposal status transitions", function () {
        it("should track proposal from INITIALIZED to QUEUED to EXECUTED", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            // Fund safeStorage
            await fixture.owner1.sendTransaction({
                to: fixture.safeStorage.target,
                value: ethers.parseEther("1.0"),
            });

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    value: ethers.parseEther("0.5"),
                    callFrom: fixture.safeStorage.target,
                })
            );

            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.INITIALIZED));

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.INITIALIZED));

            await fixture.multisig.connect(fixture.owner3).sign(proposalId);
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.QUEUED));

            const proposal = await fixture.multisig.proposals(proposalId);
            await time.increaseTo(proposal.eta + 1n);

            await fixture.multisig.connect(fixture.owner1).execute(proposalId, false, { value: ethers.parseEther("0.5") });
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.EXECUTED));
        });

        it("should transition from INITIALIZED to CANCELLED", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    callFrom: fixture.safeStorage.target,
                })
            );

            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.INITIALIZED));

            await fixture.multisig.connect(fixture.owner1).cancel(proposalId);
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.CANCELLED));
        });

        it("should transition from QUEUED to CANCELLED", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    callFrom: fixture.safeStorage.target,
                })
            );

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            await fixture.multisig.connect(fixture.owner3).sign(proposalId);

            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.QUEUED));

            await fixture.multisig.connect(fixture.owner1).cancel(proposalId);
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.CANCELLED));
        });
    });

    describe("voting mechanism", function () {
        it("should track individual votes", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    callFrom: fixture.safeStorage.target,
                })
            );

            // owner1 NOT automatically marked as voted - createAndSign doesn't set votedBy mapping
            // The first signature is implicit in the signs count
            expect(await fixture.multisig.votedBy(fixture.owner2.address, proposalId)).to.be.false;

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            expect(await fixture.multisig.votedBy(fixture.owner2.address, proposalId)).to.be.true;
        });

        it("should increment sign count correctly", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    callFrom: fixture.safeStorage.target,
                })
            );

            let proposal = await fixture.multisig.proposals(proposalId);
            expect(proposal.signs).to.equal(1n);

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            proposal = await fixture.multisig.proposals(proposalId);
            expect(proposal.signs).to.equal(2n);

            await fixture.multisig.connect(fixture.owner3).sign(proposalId);
            proposal = await fixture.multisig.proposals(proposalId);
            expect(proposal.signs).to.equal(3n);
        });

        it("should queue proposal when reaching required signatures", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: fixture.other.address,
                    callFrom: fixture.safeStorage.target,
                })
            );

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            
            const statusBefore = await fixture.multisig.getStatus(proposalId);
            expect(statusBefore).to.equal(BigInt(status.INITIALIZED));

            await fixture.multisig.connect(fixture.owner3).sign(proposalId);
            
            const statusAfter = await fixture.multisig.getStatus(proposalId);
            expect(statusAfter).to.equal(BigInt(status.QUEUED));
        });
    });

    describe("getActions", function () {
        it("should return proposal actions correctly", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const token = await ERC20Mock.deploy();
            await token.waitForDeployment();

            const transferData = token.interface.encodeFunctionData("transfer", [fixture.other.address, 100n]);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: token.target as string,
                    value: 0n,
                    signature: "transfer(address,uint256)",
                    calldata: transferData,
                    callFrom: fixture.safeStorage.target,
                })
            );

            const actions = await fixture.multisig.getActions(proposalId);
            
            expect(actions.targets.length).to.equal(1);
            expect(actions.targets[0]).to.equal(token.target);
            expect(actions.signatures.length).to.equal(1);
            expect(actions.signatures[0]).to.equal("transfer(address,uint256)");
            expect(actions.calldatas.length).to.equal(1);
            expect(actions.calldatas[0]).to.equal(transferData);
            // Verify values is returned (tuple in Solidity)
            expect(actions.values).to.not.be.undefined;
        });
    });

    describe("adminCall", function () {
        it("should revert if called directly (not via timelock)", async function () {
            const fixture = await loadFixture(deployCoreFixture);

            const data = fixture.multisig.interface.encodeFunctionData("addSigner", [fixture.other.address]);

            await expect(
                fixture.multisig.connect(fixture.owner1).adminCall(data)
            ).to.be.revertedWithCustomError(fixture.multisig, "OnlyTimelock");
        });
    });
});
