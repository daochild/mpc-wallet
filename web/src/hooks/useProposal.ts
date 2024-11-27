import {useCallback, useEffect, useState} from 'react';
import {Interface, isAddress} from "ethers/lib/utils";
import {handle} from '../api';
import {getABI} from "../api/bsc";
import _ from 'lodash';
import {useAlert} from "./useAlert";
import {classAlert} from "../contexts/AlertProvider";

export function useProposal(address: string) {

    const [contractFunc, setContractFunc] = useState<any[]>([]);
    const [contractInterface, setContractInterface] = useState<Interface | null>(null);

    const {showAlert} = useAlert()

    const getABIHandle = useCallback( async (address) => {
        try {
            const [addRes, addErr] = await handle(getABI(address))
            if (addRes?.data) {
                const {result} = addRes?.data
                if (result) {
                    if (result === 'Contract source code not verified') {
                        showAlert({text: 'Contract source code not verified', cls: classAlert.error})
                        return
                    }
                    setContractInterface(new Interface(result))
                    const payableFunc = JSON.parse(result).filter((item: any) => item.type === 'function' && (item.stateMutability === "nonpayable" || item.stateMutability === "payable"))
                    setContractFunc(_.uniqBy(payableFunc, (func) => func.name))
                }
            } else {
                console.log('addErr', addErr);
            }
        } catch (e: any) {
            console.log('getABI', e.message || e);
        }
    }, [showAlert])

    useEffect(() => {
        if (isAddress(address)) {
            getABIHandle(address)
        } else {
            setContractFunc([])
        }
    }, [address, getABIHandle])


    return {
        contractFunc,
        contractInterface
    }
}

