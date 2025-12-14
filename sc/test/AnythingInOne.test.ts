import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployCoreFixture, buildSingleActionProposal, createProposal, queueProposal } from "./fixtures/core";
import { computeTxnHash, status } from "./helpers/proposals";
import type { CoreFixture } from "./fixtures/core";

describe("AnythingInOne", function () {
    describe("proposal lifecycle", function () {
        it("queues a proposal after required signatures", async () => {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalInput = buildSingleActionProposal({
                target: fixture.other.address,
                value: 1n,
                callFrom: fixture.safeStorage.target,
            });

            const proposalId = await createProposal(fixture.multisig, fixture.owner1, proposalInput);
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.INITIALIZED));

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            await fixture.multisig.connect(fixture.owner3).sign(proposalId);

            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.QUEUED));

            const proposal = await fixture.multisig.proposals(proposalId);
            expect(proposal.signs).to.equal(3n);
            expect(proposal.eta).to.not.equal(0n);
        });

        it("prevents duplicate signatures from the same owner", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({ target: fixture.other.address, callFrom: fixture.safeStorage.target })
            );

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            await expect(fixture.multisig.connect(fixture.owner2).sign(proposalId))
                .to.be.revertedWithCustomError(fixture.multisig, "AlreadySigned");
        });

        it("cancels proposal once signing window expires", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({ target: fixture.other.address, callFrom: fixture.safeStorage.target })
            );

            // Advance beyond TIME_FOR_SIGNING (1 day) to trigger auto-cancel
            await time.increase(60 * 60 * 24 + 1);

            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.CANCELLED));
        });
    });

    describe("execution flows", function () {
        async function queueDefaultEthWithdrawal(fixture: CoreFixture) {
            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({ target: fixture.other.address, value: 1n, callFrom: fixture.safeStorage.target })
            );
            const eta = await queueProposal(fixture.multisig, [fixture.owner2, fixture.owner3], proposalId);
            await time.increaseTo(eta + 1n);
            return proposalId;
        }

        it("executes ETH withdrawal proposal", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const proposalId = await queueDefaultEthWithdrawal(fixture);

            await fixture.multisig.connect(fixture.owner3).execute(proposalId, false, { value: 1n });
            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.EXECUTED));
        });

        it("reverts execution when status is not queued", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({ target: fixture.other.address, callFrom: fixture.safeStorage.target })
            );

            await expect(fixture.multisig.connect(fixture.owner1).execute(proposalId, false))
                .to.be.revertedWithCustomError(fixture.multisig, "WrongStatus");
        });

        it("executes ERC20 transfer proposal", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const erc20 = await ERC20Mock.deploy();
            await erc20.waitForDeployment();
            await erc20.mint(fixture.safeStorage.target, 100n);

            const transferData = erc20.interface.encodeFunctionData("transfer", [fixture.other.address, 100n]);
            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: erc20.target as string,
                    value: 0n,
                    signature: "transfer(address,uint256)",
                    calldata: transferData,
                    callFrom: fixture.safeStorage.target,
                })
            );

            const eta = await queueProposal(fixture.multisig, [fixture.owner2, fixture.owner3], proposalId);
            await time.increaseTo(eta + 1n);

            await fixture.multisig.connect(fixture.owner3).execute(proposalId, false);
            expect(await erc20.balanceOf(fixture.other.address)).to.equal(100n);
        });

        it("allows cancelling a queued proposal and prevents execution", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({ target: fixture.other.address, callFrom: fixture.safeStorage.target })
            );

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            await fixture.multisig.connect(fixture.owner3).sign(proposalId);
            await fixture.multisig.connect(fixture.owner1).cancel(proposalId);

            expect(await fixture.multisig.getStatus(proposalId)).to.equal(BigInt(status.CANCELLED));
            await expect(fixture.multisig.connect(fixture.owner1).execute(proposalId, false))
                .to.be.revertedWithCustomError(fixture.multisig, "WrongStatus");
        });
    });

    describe("timelock integration", function () {
        it("queues timelock transactions with expected hashes", async () => {
            const fixture = await loadFixture(deployCoreFixture);

            const proposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({ target: fixture.other.address, value: 1n, callFrom: fixture.safeStorage.target })
            );

            await fixture.multisig.connect(fixture.owner2).sign(proposalId);
            const tx = await fixture.multisig.connect(fixture.owner3).sign(proposalId);
            const receipt = await tx.wait();

            const eta = (await fixture.multisig.proposals(proposalId)).eta;
            const expectedHash = computeTxnHash(
                proposalId,
                0n,
                fixture.other.address,
                1n,
                "",
                "0x",
                eta
            );

            // Verify transaction was queued in timelock
            const isQueued = await fixture.timelock.queuedTransactions(expectedHash);
            expect(isQueued).to.equal(true);
        });
    });

    describe("asset custody", function () {
        it("accepts ERC721 and ERC1155 tokens", async () => {
            const fixture = await loadFixture(deployCoreFixture);
            const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
            const ERC1155Mock = await ethers.getContractFactory("ERC1155Mock");

            const erc721 = await ERC721Mock.deploy();
            const erc1155 = await ERC1155Mock.deploy();
            await erc721.waitForDeployment();
            await erc1155.waitForDeployment();

            await erc721.mint(fixture.safeStorage.target, 1n);
            await erc1155.mint(fixture.safeStorage.target, 1n, 100n, "0x");

            expect(await erc721.balanceOf(fixture.safeStorage.target)).to.equal(1n);
            expect(await erc1155.balanceOf(fixture.safeStorage.target, 1n)).to.equal(100n);

            // withdraw ERC721
            const erc721TransferData = erc721.interface.encodeFunctionData("safeTransferFrom(address,address,uint256)", [
                fixture.safeStorage.target,
                fixture.other.address,
                1n
            ]);
            const erc721ProposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: erc721.target as string,
                    value: 0n,
                    signature: "safeTransferFrom(address,address,uint256)",
                    calldata: erc721TransferData,
                    callFrom: fixture.safeStorage.target,
                })
            );
            let eta = await queueProposal(fixture.multisig, [fixture.owner2, fixture.owner3], erc721ProposalId);
            await time.increaseTo(eta + 1n);
            await fixture.multisig.connect(fixture.owner3).execute(erc721ProposalId, false);
            expect(await erc721.balanceOf(fixture.other.address)).to.equal(1n);

            // withdraw ERC1155
            const erc1155TransferData = erc1155.interface.encodeFunctionData("safeTransferFrom(address,address,uint256,uint256,bytes)", [
                fixture.safeStorage.target,
                fixture.other.address,
                1n,
                100n,
                "0x"
            ]);
            const erc1155ProposalId = await createProposal(
                fixture.multisig,
                fixture.owner1,
                buildSingleActionProposal({
                    target: erc1155.target as string,
                    value: 0n,
                    signature: "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    calldata: erc1155TransferData,
                    callFrom: fixture.safeStorage.target,
                })
            );
            eta = await queueProposal(fixture.multisig, [fixture.owner2, fixture.owner3], erc1155ProposalId);
            await time.increaseTo(eta + 1n);
            await fixture.multisig.connect(fixture.owner3).execute(erc1155ProposalId, false);
            expect(await erc1155.balanceOf(fixture.other.address, 1n)).to.equal(100n);

        });
    });
});
