import React, {useCallback, useEffect, useMemo, useState} from 'react';
import classes from './CreateProposal.module.scss';
import {Control, UseFormRegister} from "react-hook-form/dist/types/form";
import {FieldErrors} from "react-hook-form/dist/types/errors";
import {useProposal} from "../../hooks/useProposal";
import {useWatch} from "react-hook-form";
import {isAddress} from "ethers/lib/utils";
import _ from 'lodash';

interface ProposalDetailsProps {
    register: UseFormRegister<any>,
    errors: FieldErrors<any>,
    id: number,
    onRemove: (id: number) => void,
    showDescription: boolean,
    control: Control,
    setValue: (key: string, value: string) => void
}

function ProposalDetails({register, errors, id, onRemove, showDescription = false, control, setValue}: ProposalDetailsProps) {

    const [currentMethod, setCurrentMethod] = useState<any>(null);

    const isPayable = useMemo(() => {
        if (currentMethod) {
            return currentMethod.stateMutability === "payable"
        }
        return false
    }, [currentMethod])

    const target = useWatch({
        control,
        name: `target-${id}`
    })

    const inputs = useWatch({
        control,
        name: `inputs-${id}`
    })

    const method = useWatch({
        control,
        name: `method-${id}`
    })
    const {contractFunc, contractInterface} = useProposal(target)

    const onHexHandler = useCallback(() => {
        if (contractInterface && method  && currentMethod && (currentMethod?.inputs.length === 0 || inputs)) {
            const fragment = contractInterface.getFunction(method)
            const inputsArr = inputs?.split(',').map((input: any) => input.trim()).filter((item: any) => Boolean(item)) || []
            if (currentMethod.inputs.length === inputsArr.length) {
                const callData = contractInterface.encodeFunctionData(fragment, inputsArr)
                setValue(`callDatas-${id}`, callData)
            }
        } else {
            setValue(`callDatas-${id}`, '')
        }
    }, [contractInterface, currentMethod, id, inputs, method, setValue])

    useEffect(() => {
        onHexHandler()
    }, [onHexHandler])


    useEffect(() => {
        const curMethod = _.find(contractFunc, (item) => item.name === method);
        if (curMethod && contractInterface) {
            setCurrentMethod(curMethod)
        }
    }, [contractFunc, contractInterface, id, method, setValue])

    const onInputsValidate = useCallback((value) => {
        const arrValue = value.split(',').filter((item: any) => Boolean(item))
        if (!currentMethod) return ''
        let isEmptyArgs = false
        for (const item of arrValue) {
            if (!Boolean(item.trim())) {
                isEmptyArgs = true
                break
            }
        }
        const inputsForMethod = currentMethod.inputs
        if (inputsForMethod.length !== arrValue.length || (inputsForMethod.length > 0 && isEmptyArgs)) return 'Count arguments error';
        let isValid = true
        for (const key in arrValue) {
            const inputType = inputsForMethod[key].type;
            if (inputType === 'address') {
                if (!isAddress(arrValue[key])) {
                    isValid = false
                    break
                }
            } else if (arrValue[key].trim() === '') {
                isValid = false
                break
            }
        }
        return isValid || 'Error inputs'
    }, [currentMethod])


    const renderInputsName = useCallback(() => {
        if (currentMethod) {
            const inputsNames = currentMethod.inputs.map((item: any) => [item.name, item.type].join(': '))
            return inputsNames.join('; ')
        }
        return null
    }, [currentMethod])

    return (
        <div className={classes.ProposalDetails}>
            <div className={classes.ProposalColumn}>
                <label className={'label'} htmlFor={`target-${id}`}>Target</label>
                <input className={['input', errors[`target-${id}`] ? 'error' : ''].join(' ')}
                       type="text" {...register(`target-${id}`, {
                    validate: {
                        isAddress: value => isAddress(value) || 'Is not address'
                    },
                })}
                />
                {
                    errors[`target-${id}`] && <p className={'error-message'}>{errors[`target-${id}`]?.message}</p>
                }
                {
                    isPayable && <label className={'label'} htmlFor={`value-${id}`}>Value</label>
                }
                <input type={isPayable ? 'number' : "hidden"}
                       className={isPayable ? ['input', errors[`value-${id}`] ? 'error' : ''].join(' '): ''}
                       {...register(`value-${id}`, {
                           value: '0',
                           validate: value => value >= 0 || 'More then Zero'
                       })}
                />
                {
                    isPayable && errors[`value-${id}`] && <p className={'error-message'}>{errors[`value-${id}`]?.message}</p>
                }
                <input type="hidden" {...register(`callDatas-${id}`, {value: ''})}/>
                <label className={'label'} htmlFor={`method-${id}`}>Method</label>
                <select
                    className={['input', errors[`method-${id}`] ? 'error' : ''].join(' ')} {...register(`method-${id}`, {
                        required: true,
                        minLength: {
                            value: 3,
                            message: 'Don`t choose method'
                        }
                    }
                )} id={`method-${id}`}>
                    <option value="">Please select method</option>
                    {
                        contractFunc && contractFunc.map((func) => {
                            return (
                                <option key={`${id}-select-${func.name}`} value={func.name}>{func.name}</option>
                            )
                        })
                    }
                </select>
                {
                    errors[`method-${id}`] && <p className={'error-message'}>{errors[`method-${id}`]?.message}</p>
                }
                <label className={'label'}
                       htmlFor={`inputs-${id}`}>Arguments {currentMethod && `[${renderInputsName()}]`}</label>
                <input disabled={currentMethod?.inputs?.length === 0} className={['input', errors[`inputs-${id}`] ? 'error' : ''].join(' ')}
                       placeholder={`arguments via ','`} id={`inputs-${id}`}
                       type="text" {...register(`inputs-${id}`, {
                    required: false,
                    validate: onInputsValidate
                    // minLength: {
                    //     value: 5,
                    //     message: 'Don`t arguments'
                    // }
                })}/>
                {
                    errors[`inputs-${id}`] && <p className={'error-message'}>{errors[`inputs-${id}`]?.message}</p>
                }
            </div>
            {
                showDescription && <div className={classes.ProposalColumn}>
                    <label className={'label'} htmlFor={`description-${id}`}>Description</label>
                    <textarea
                        className={['input', errors[`description-${id}`] ? 'error' : ''].join(' ')} {...register(`description-${id}`, {
                        required: true, maxLength: {
                            value: 100,
                            message: 'Max 100 symbols'
                        }
                    })}
                        id={`description-${id}`}/>
                    {
                        errors[`description-${id}`] &&
                        <p className={'error-message'}>{errors[`description-${id}`]?.message}</p>
                    }
                </div>
            }
            <div className={classes.ButtonBlock}>
                <button onClick={() => onRemove(id)} type='button' className="button">Remove</button>
            </div>
        </div>
    );
}

export default ProposalDetails;