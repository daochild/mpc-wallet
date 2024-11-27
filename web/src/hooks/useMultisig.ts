import {useMulticallContract, useMultisigContract} from "./useContract";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useWeb3React} from "@web3-react/core";
import {useAlert} from "./useAlert";
import {classAlert} from "../contexts/AlertProvider";
import {shortAddress} from "../util";
import useBlockNumber from "./useBlockNumber";
import {BigNumber} from "ethers";
import {defaultChainId, multisigAddress} from "../config";
import _ from "lodash";

interface IProposal {
    targets: string[],
    values: string[],
    signatures: string[],
    calldatas: string[],
    description: string
}

export enum EStatus {
    EMPTY, // zero state
    INITIALIZED, // created with one sign
    CANCELLED, // canceled by consensus
    QUEUED, // approved and send to timelock
    EXECUTED // executed
}

export const Status: { [status in EStatus | number]: string } = {
    [EStatus.EMPTY]: 'Empty',
    [EStatus.INITIALIZED]: 'INITIALIZED',
    [EStatus.CANCELLED]: 'CANCELLED',
    [EStatus.QUEUED]: 'QUEUED',
    [EStatus.EXECUTED]: 'EXECUTED',
}

export function useMultisig() {
    const {account} = useWeb3React()
    const [pending, setPending] = useState<{ [method: string]: boolean }>({
        cancel: false,
        create: false,
        sign: false,
        execute: false,
    });
    const multisigContract = useMultisigContract()
    const multicallContract = useMulticallContract()
    const blockNumber = useBlockNumber()
    const {showAlert} = useAlert()
    const [proposalCount, setProposalCount] = useState<number>(0);
    const [proposals, setProposals] = useState<any[]>([]);

    const getData = useCallback(() => {
        if (multisigContract) {
            multisigContract.proposalCount()
                .then((res: BigNumber) => {
                    setProposalCount(res.toNumber())
                })
                .catch((err: any) => {
                    console.log(err.message || err)
                })
        }
    }, [multisigContract])

    useEffect(() => {
        getData()
    }, [getData, blockNumber])

    const proposalsIds = useMemo(() => {
        if (proposalCount > 0 && multisigContract) {
            const limit = proposalCount > 10 ? proposalCount - 10 : 0
            const ids: number[] = []
            for (let i = proposalCount; i > limit; i--) {
                ids.push(i)
            }
            return ids
        }
        return []
    }, [multisigContract, proposalCount])

    const proposalsProps = useMemo(() => {
        if (proposalsIds.length > 0 && multisigContract) {
            const encodes: Array<[string, string]> = []
            for (const proposalsId of proposalsIds) {
                const fragment = multisigContract.interface.getFunction('proposals');
                const encodeFunctions = multisigContract.interface.encodeFunctionData(fragment, [proposalsId])
                encodes.push([multisigAddress[defaultChainId], encodeFunctions])
            }
            return encodes
        }
        return []
    }, [multisigContract, proposalsIds])

    const getStatusProps = useMemo(() => {
        if (proposalsIds.length > 0 && multisigContract) {
            const encodes: Array<[string, string]> = []
            for (const proposalsId of proposalsIds) {
                const fragment = multisigContract.interface.getFunction('getStatus');
                const encodeFunctions = multisigContract.interface.encodeFunctionData(fragment, [proposalsId])
                encodes.push([multisigAddress[defaultChainId], encodeFunctions])
            }
            return encodes
        }
        return []
    }, [multisigContract, proposalsIds])

    useEffect(() => {
        if (multicallContract && proposalsProps.length > 0) {
            const fragmentProposals = multisigContract.interface.getFunction('proposals');
            const fragmentGetStatus = multisigContract.interface.getFunction('getStatus');
            multicallContract.aggregate(_.concat(proposalsProps, getStatusProps))
                .then(([blockNumberRes, resData]: any) => {
                    const getStatusData = resData.slice(resData.length / 2).map((item: any) => {
                        return multisigContract.interface.decodeFunctionResult(fragmentGetStatus, item)
                    })
                    const proposalsData = resData.slice(0, resData.length / 2).map((item: any, id: number) => {
                        return {
                            id: proposalsIds[id],
                            ...multisigContract.interface.decodeFunctionResult(fragmentProposals, item),
                            status: getStatusData[id]?.[0] || 0
                        }
                    })
                    setProposals(proposalsData)
                })
                .catch((e: any) => {
                    console.log('error', e.data?.message || e.message || e);
                })
        }
    }, [getStatusProps, multicallContract, multisigContract.interface, proposalsIds, proposalsProps, blockNumber])

    const createAndSign = useCallback((proposal: IProposal) => {
        if (multisigContract) {
            setPending(prevState => {
                return {
                    ...prevState,
                    create: true
                }
            })
            multisigContract.createAndSign(...Object.values(proposal), {from: account})
                .then(async (res: any) => {
                    const result = await res.wait()
                    showAlert({
                        text: `Create Sign ${result.status === 1 ? 'success' : 'failed'} ${shortAddress(res.hash)}`,
                        cls: result.status === 1 ? classAlert.success : classAlert.error
                    })
                })
                .catch((e: any) => {
                    showAlert({
                        text: `Create Sign failed: ${e.data?.message || e.message || e}`,
                        cls: classAlert.error
                    })
                })
                .finally(() =>
                    setPending(prevState => {
                        return {
                            ...prevState,
                            create: false
                        }
                    }))
            setTimeout(() => {
                setPending(prevState => {
                    return {
                        ...prevState,
                        create: false
                    }
                })
            }, 2000)
        }
    }, [account, multisigContract, showAlert])

    const onSign = useCallback((proposalId: number) => {
        if (multisigContract) {
            setPending(prevState => {
                return {
                    ...prevState,
                    sign: true
                }
            })
            multisigContract.sign(proposalId, {from: account})
                .then(async (res: any) => {
                    const result = await res.wait()
                    showAlert({
                        text: `Sign ${result.status === 1 ? 'success' : 'failed'} ${shortAddress(res.hash)}`,
                        cls: result.status === 1 ? classAlert.success : classAlert.error
                    })
                })
                .catch((e: any) => {
                    showAlert({
                        text: `Sign failed: ${e.data?.message || e.message || e}`,
                        cls: classAlert.error
                    })
                })
                .finally(() =>
                    setPending(prevState => {
                        return {
                            ...prevState,
                            sign: false
                        }
                    }))
        }
    }, [account, multisigContract, showAlert])

    const onExecute = useCallback((proposalId: number) => {
        if (multisigContract) {
            setPending(prevState => {
                return {
                    ...prevState,
                    execute: true
                }
            })
            multisigContract.execute(proposalId, true, {from: account})
                .then(async (res: any) => {
                    const result = await res.wait()
                    showAlert({
                        text: `Execute ${result.status === 1 ? 'success' : 'failed'} ${shortAddress(res.hash)}`,
                        cls: result.status === 1 ? classAlert.success : classAlert.error
                    })
                })
                .catch((e: any) => {
                    showAlert({
                        text: `Execute failed: ${e.data?.message || e.message || e}`,
                        cls: classAlert.error
                    })
                })
                .finally(() => setPending(prevState => {
                    return {
                        ...prevState,
                        execute: false
                    }
                }))
        }
    }, [account, multisigContract, showAlert])
    const onCancel = useCallback((proposalId: number) => {
        if (multisigContract) {
            setPending(prevState => {
                return {
                    ...prevState,
                    cancel: true
                }
            })
            multisigContract.cancel(proposalId, {from: account})
                .then(async (res: any) => {
                    const result = await res.wait()
                    showAlert({
                        text: `Cancel ${result.status === 1 ? 'success' : 'failed'} ${shortAddress(res.hash)}`,
                        cls: result.status === 1 ? classAlert.success : classAlert.error
                    })
                })
                .catch((e: any) => {
                    showAlert({
                        text: `Cancel failed: ${e.data?.message || e.message || e}`,
                        cls: classAlert.error
                    })
                })
                .finally(() => setPending(prevState => {
                    return {
                        ...prevState,
                        cancel: false
                    }
                }))
        }
    }, [account, multisigContract, showAlert])

    return useMemo(() => {
        return {
            createAndSign,
            pending,
            multisigContract,
            proposals,
            onSign,
            onCancel,
            onExecute
        }
    }, [createAndSign, multisigContract, onCancel, onExecute, onSign, pending, proposals])
}