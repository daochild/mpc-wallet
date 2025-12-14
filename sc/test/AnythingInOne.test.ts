import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const status = Object.freeze({
    EMPTY: 0,
    INITIALIZED: 1,
    CANCELLED: 2,
    QUEUED: 3,
    EXECUTED: 4,
});

async function deployCoreFixture() {
    const [deployer, owner1, owner2, owner3, owner4, other] = await ethers.getSigners();

    const SafeStorage = await ethers.getContractFactory("SafeStorage");
    const safeStorage = await SafeStorage.deploy(deployer.address);
    await safeStorage.waitForDeployment();

    const Timelock = await ethers.getContractFactory("Timelock");
    const timelock = await Timelock.deploy(safeStorage.target, 6 * 60 * 60);
    await timelock.waitForDeployment();

    await safeStorage.transferOwnership(timelock.target);

    const Multisig = await ethers.getContractFactory("Multisig");
    const multisig = await Multisig.deploy(timelock.target, [owner1.address, owner2.address, owner3.address, owner4.address]);
    await multisig.waitForDeployment();

    await timelock.transferOwnership(multisig.target);

    return {
        deployer,
        owner1,
        owner2,
        owner3,
        owner4,
        other,
        safeStorage,
        timelock,
        multisig,
    };
}

const buildProposal = (target: string, value: bigint, callFrom: string) => ({
    targets: [target],
    values: [value],
    signatures: [""],
    calldatas: ["0x"],
    description: "",
    callFrom,
});

describe("AnythingInOne", function () {
    describe("main flow", function () {
        it("queues a proposal after required signatures", async () => {
            const { owner1, owner2, owner3, other, safeStorage, timelock, multisig } = await loadFixture(deployCoreFixture);

            const proposalInput = buildProposal(other.address, 1n, safeStorage.target);

            await multisig.connect(owner1).createAndSign(
                proposalInput.targets,
                proposalInput.values,
                proposalInput.signatures,
                proposalInput.calldatas,
                proposalInput.description,
                proposalInput.callFrom
            );

            const proposalId = await multisig.proposalCount();
            expect(proposalId).to.equal(1n);
            expect(await multisig.getStatus(proposalId)).to.equal(BigInt(status.INITIALIZED));
            expect(await timelock.safeStorage()).to.equal(safeStorage.target);

            await multisig.connect(owner2).sign(proposalId);
            await multisig.connect(owner3).sign(proposalId);

            const queuedStatus = await multisig.getStatus(proposalId);
            expect(queuedStatus).to.equal(BigInt(status.QUEUED));

            const proposal = await multisig.proposals(proposalId);
            expect(proposal.signs).to.equal(3n);
            expect(proposal.eta).to.not.equal(0n);
        });

        it("executes ETH withdrawal proposal", async () => {
            const { owner1, owner2, owner3, other, safeStorage, multisig } = await loadFixture(deployCoreFixture);

            const proposalInput = buildProposal(other.address, 1n, safeStorage.target);

            await multisig.connect(owner1).createAndSign(
                proposalInput.targets,
                proposalInput.values,
                proposalInput.signatures,
                proposalInput.calldatas,
                proposalInput.description,
                proposalInput.callFrom
            );

            const proposalId = await multisig.proposalCount();
            await multisig.connect(owner2).sign(proposalId);
            await multisig.connect(owner3).sign(proposalId);

            const eta = (await multisig.proposals(proposalId)).eta;
            await time.increaseTo(eta + 1n);

            await multisig.connect(owner3).execute(proposalId, false, { value: 1n });

            expect(await multisig.getStatus(proposalId)).to.equal(BigInt(status.EXECUTED));
        });

        it("executes ERC20 transfer proposal", async () => {
            const { owner1, owner2, owner3, other, safeStorage, multisig } = await loadFixture(deployCoreFixture);

            const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
            const erc20 = await ERC20Mock.deploy();
            await erc20.waitForDeployment();
            await erc20.mint(safeStorage.target, 100n);

            const transferData = erc20.interface.encodeFunctionData("transfer", [other.address, 100n]);

            await multisig.connect(owner1).createAndSign(
                [erc20.target],
                [0n],
                ["transfer(address,uint256)"],
                [transferData],
                "transfer ERC20 tokens",
                safeStorage.target
            );

            const proposalId = await multisig.proposalCount();
            await multisig.connect(owner2).sign(proposalId);
            await multisig.connect(owner3).sign(proposalId);

            const eta = (await multisig.proposals(proposalId)).eta;
            await time.increaseTo(eta + 1n);

            await multisig.connect(owner3).execute(proposalId, false);

            expect(await erc20.balanceOf(other.address)).to.equal(100n);
            expect(await erc20.balanceOf(safeStorage.target)).to.equal(0n);
        });

        it("accepts ERC721 and ERC1155 tokens", async () => {
            const { safeStorage } = await loadFixture(deployCoreFixture);

            const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
            const ERC1155Mock = await ethers.getContractFactory("ERC1155Mock");

            const erc721 = await ERC721Mock.deploy();
            const erc1155 = await ERC1155Mock.deploy();
            await erc721.waitForDeployment();
            await erc1155.waitForDeployment();

            await erc721.mint(safeStorage.target, 1n);
            await erc1155.mint(safeStorage.target, 1n, 100n, "0x");

            expect(await erc721.balanceOf(safeStorage.target)).to.equal(1n);
            expect(await erc1155.balanceOf(safeStorage.target, 1n)).to.equal(100n);
        });
    });
});