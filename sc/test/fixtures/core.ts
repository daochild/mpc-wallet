import { ethers } from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { Multisig, SafeStorage, Timelock } from "../../typechain";

export interface CoreFixture {
    deployer: SignerWithAddress;
    owner1: SignerWithAddress;
    owner2: SignerWithAddress;
    owner3: SignerWithAddress;
    owner4: SignerWithAddress;
    other: SignerWithAddress;
    safeStorage: SafeStorage;
    timelock: Timelock;
    multisig: Multisig;
}

export interface ProposalInput {
    targets: string[];
    values: bigint[];
    signatures: string[];
    calldatas: string[];
    description: string;
    callFrom: string;
}

interface BuildProposalParams {
    targets: string[];
    values?: bigint[];
    signatures?: string[];
    calldatas?: string[];
    description?: string;
    callFrom: string;
}

interface SingleActionParams {
    target: string;
    value?: bigint;
    signature?: string;
    calldata?: string;
    description?: string;
    callFrom: string;
}

export async function deployCoreFixture(): Promise<CoreFixture> {
    const [deployer, owner1, owner2, owner3, owner4, other] = await ethers.getSigners();

    const SafeStorageFactory = await ethers.getContractFactory("SafeStorage");
    const safeStorage = (await SafeStorageFactory.deploy(deployer.address)) as SafeStorage;
    await safeStorage.waitForDeployment();

    const TimelockFactory = await ethers.getContractFactory("Timelock");
    const timelock = (await TimelockFactory.deploy(safeStorage.target, 6 * 60 * 60)) as Timelock;
    await timelock.waitForDeployment();

    await safeStorage.transferOwnership(timelock.target);

    const MultisigFactory = await ethers.getContractFactory("Multisig");
    const multisig = (await MultisigFactory.deploy(timelock.target, [
        owner1.address,
        owner2.address,
        owner3.address,
        owner4.address,
    ])) as Multisig;
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

export function buildProposalInput(params: BuildProposalParams): ProposalInput {
    const length = params.targets.length;
    if (length === 0) {
        throw new Error("Proposal must include at least one target");
    }

    const assertLength = (arr: unknown[] | undefined, label: string) => {
        if (arr && arr.length !== length) {
            throw new Error(`${label} length must match targets length`);
        }
    };

    assertLength(params.values, "values");
    assertLength(params.signatures, "signatures");
    assertLength(params.calldatas, "calldatas");

    return {
        targets: params.targets,
        values: (params.values ?? Array<bigint>(length).fill(0n)) as bigint[],
        signatures: (params.signatures ?? Array<string>(length).fill("")) as string[],
        calldatas: (params.calldatas ?? Array<string>(length).fill("0x")) as string[],
        description: params.description ?? "",
        callFrom: params.callFrom,
    };
}

export function buildSingleActionProposal(params: SingleActionParams): ProposalInput {
    return buildProposalInput({
        targets: [params.target],
        values: [params.value ?? 0n],
        signatures: [params.signature ?? ""],
        calldatas: [params.calldata ?? "0x"],
        description: params.description,
        callFrom: params.callFrom,
    });
}

export async function createProposal(
    multisig: Multisig,
    creator: SignerWithAddress,
    proposal: ProposalInput
): Promise<bigint> {
    await multisig.connect(creator).createAndSign(
        proposal.targets,
        proposal.values,
        proposal.signatures,
        proposal.calldatas,
        proposal.description,
        proposal.callFrom
    );

    return await multisig.proposalCount();
}

export async function queueProposal(
    multisig: Multisig,
    signers: SignerWithAddress[],
    proposalId: bigint
): Promise<bigint> {
    for (const signer of signers) {
        await multisig.connect(signer).sign(proposalId);
    }

    return (await multisig.proposals(proposalId)).eta;
}
