import useWeb3Provider from "./useWeb3Provider";
import {useMemo} from "react";
import {
    defaultChainId,
    MulticallAbi,
    multicallAddress,
    MultisigAbi,
    multisigAddress, SafeStorageAbi,
    safeStorageAddress, TimelockAbi, timelockAddress
} from "../config";
import {getContract} from "../util/contracts";

export const useMultisigContract = () => {
    const provider = useWeb3Provider();
    return useMemo(() => {
        return getContract(MultisigAbi, multisigAddress[defaultChainId], provider.getSigner())
    }, [provider])
}
export const useMulticallContract = () => {
    const provider = useWeb3Provider();
    return useMemo(() => {
        return getContract(MulticallAbi, multicallAddress[defaultChainId], provider.getSigner())
    }, [provider])
}
export const useSafeStorageContract = () => {
    const provider = useWeb3Provider();
    return useMemo(() => {
        return getContract(SafeStorageAbi, safeStorageAddress[defaultChainId], provider.getSigner())
    }, [provider])
}
export const useTimelockContract = () => {
    const provider = useWeb3Provider();
    return useMemo(() => {
        return getContract(TimelockAbi, timelockAddress[defaultChainId], provider.getSigner())
    }, [provider])
}