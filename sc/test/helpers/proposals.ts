import { ethers } from "hardhat";
import type { Multisig } from "../../typechain";
import type { CoreFixture, ProposalInput } from "../fixtures/core";

export const status = Object.freeze({
    EMPTY: 0,
    INITIALIZED: 1,
    CANCELLED: 2,
    QUEUED: 3,
    EXECUTED: 4,
});

export const abiCoder = ethers.AbiCoder.defaultAbiCoder();

export const computeTxnHash = (
    proposalId: bigint,
    actionIndex: bigint,
    target: string,
    value: bigint,
    signature: string,
    data: string,
    eta: bigint
) =>
    ethers.keccak256(
        abiCoder.encode(
            ["uint256", "uint256", "address", "uint256", "string", "bytes", "uint256"],
            [proposalId, actionIndex, target, value, signature, data, eta]
        )
    );

export async function signWithThreshold(
    multisig: Multisig,
    signers: CoreFixture["owner1"][],
    proposalId: bigint,
    threshold: number
) {
    for (const signer of signers.slice(0, threshold - 1)) {
        await multisig.connect(signer).sign(proposalId);
    }
}

export async function signUntilQueued(
    multisig: Multisig,
    signers: CoreFixture["owner1"][],
    proposalId: bigint
) {
    for (const signer of signers) {
        await multisig.connect(signer).sign(proposalId);
        const statusValue = await multisig.getStatus(proposalId);
        if (statusValue === BigInt(status.QUEUED)) {
            return signer;
        }
    }
    throw new Error("Proposal never reached QUEUED");
}

export function getDefaultSingleActionProposal(fixture: CoreFixture, overrides?: Partial<ProposalInput>) {
    return {
        targets: overrides?.targets ?? [fixture.other.address],
        values: overrides?.values ?? [1n],
        signatures: overrides?.signatures ?? [""],
        calldatas: overrides?.calldatas ?? ["0x"],
        description: overrides?.description ?? "",
        callFrom: overrides?.callFrom ?? fixture.safeStorage.target as string,
    } satisfies ProposalInput;
}
