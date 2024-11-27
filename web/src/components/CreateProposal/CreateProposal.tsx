import React, {useCallback, useState} from 'react';
import classes from './CreateProposal.module.scss';
import {ProposalDetails} from "./index";
import {SubmitHandler, useForm} from "react-hook-form";
import _ from "lodash";
import {useWeb3React} from "@web3-react/core";
import {toWei} from "web3-utils";
import {useMultisig} from "../../hooks/useMultisig";
import {defaultChainId, safeStorageAddress} from "../../config";

interface IData {
    target: string,
    value: string,
    method: string,
    args: string,
    callDatas: string,
}

function CreateProposal() {

    const [countInputsBlock, setCountInputsBlock] = useState<number[]>([0]);

    const {account} = useWeb3React()
    const {createAndSign, pending, multisigContract} = useMultisig()

    const {register, formState: {isValid, errors}, handleSubmit, reset, getValues, control, setValue} = useForm({
        mode: "onChange",
        reValidateMode: "onChange",
    })

    const onSubmit: SubmitHandler<any> = useCallback((data) => {
        const dataObj: { [id: string]: IData } = {}
        let description = '';
        for (const dataKey in data) {
            if (data.hasOwnProperty(dataKey) && /-/.test(dataKey)) {
                const [key, id] = dataKey.split('-')
                if (key && id) {
                    if (key === 'description') {
                        description = data[dataKey]
                    } else {
                        dataObj[id] = {
                            ...dataObj[id],
                            [key]: data[dataKey]
                        }
                    }
                }
            }
        }
        if (Object.values(dataObj).length > 0) {
            const contractData: { targets: string[], values: string[], signatures: string[], calldatas: string[], description: string, callFrom: string } = {
                targets: [],
                values: [],
                signatures: [],
                calldatas: [],
                description,
                callFrom: safeStorageAddress[defaultChainId]
            }
            for (const item of Object.values(dataObj)) {
                const {target, value, callDatas} = item
                contractData.targets.push(target);
                contractData.values.push(toWei(value));
                contractData.calldatas.push(callDatas);
            }
            createAndSign(contractData)
        }
    }, [createAndSign])

    const addInputsBlockHandler = useCallback(() => {
        const lastNumber = _.last(countInputsBlock)
        setCountInputsBlock([...countInputsBlock, lastNumber !== undefined ? lastNumber + 1 : 0])
    }, [countInputsBlock])

    const removeInputsBlockHandler = useCallback((id: number) => {
        setCountInputsBlock(_.remove(countInputsBlock, item => item !== id))
        const result = getValues()
        const newData: { [key: string]: string } = {}
        for (const resultKey in result) {
            if (result.hasOwnProperty(resultKey) && /-/.test(resultKey)) {
                const resSplit = resultKey.split('-')
                const current_id = parseInt(resSplit[1]);
                if (Object.keys(result).length > 5 && resSplit[0] === 'description' && current_id === id) {
                    newData[`description-${current_id + 1}`] = result[resultKey]
                }
                if (current_id !== id) {
                    newData[resultKey] = result[resultKey]
                }
            }
        }
        reset(newData)
    }, [countInputsBlock, getValues, reset])

    const setValueHandler = useCallback((key, value) => {
        setValue(key, value)
    }, [setValue])

    return (
        <div className={['container', classes.CreateProposal].join(' ')}>
            <div className="card">
                <h2 className="card-title">Create proposal</h2>
                <h3 className="card-subtitle">Proposal details <button onClick={() => {
                    reset({})
                    setCountInputsBlock([0])
                }} type='button' className="button">Clear all</button></h3>
                <form onSubmit={handleSubmit(onSubmit)}>
                    {
                        countInputsBlock.map((id, cid) => {
                            const isFirst = cid === 0;
                            return (
                                <ProposalDetails
                                    setValue={setValueHandler}
                                    control={control}
                                    showDescription={isFirst}
                                    onRemove={removeInputsBlockHandler}
                                    key={`ProposalDetails-${id}`}
                                    id={id}
                                    register={register}
                                    errors={errors}/>
                            )
                        })
                    }
                    <div className={classes.ButtonBlock}>
                        <div className={classes.Left}>
                            <p className={classes.ButtonDesc}>
                                Add one more action to this proposal
                            </p>
                            <button onClick={addInputsBlockHandler} type='button' className="button">+</button>
                        </div>
                        <button className="button"
                                disabled={!isValid || !account || pending['create'] || !multisigContract}
                                type='submit'>
                            {pending['create'] ? 'Sending' : 'Send'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateProposal;