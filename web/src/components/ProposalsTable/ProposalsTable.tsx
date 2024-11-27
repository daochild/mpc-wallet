import React from 'react';
import classes from './ProposalsTable.module.scss';
import {EStatus, Status, useMultisig} from "../../hooks/useMultisig";

function ProposalsTable() {

    const {proposals, onCancel, pending, onSign, onExecute} = useMultisig()

    return (
        <div className={classes.Wrapper}>
            <table className={classes.ProposalsTable}>
                <thead>
                <tr>
                    <th>Proposal id</th>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {
                    proposals.map((proposal) => {
                        return (
                            <tr key={`Proposal-${proposal.id}`}>
                                <td>{proposal.id}</td>
                                <td>{Status[proposal.status]}</td>
                                <td>{proposal.description}</td>
                                <td>
                                    {
                                        (proposal.status === EStatus.INITIALIZED || proposal.status === EStatus.QUEUED) &&
                                        <button
                                            onClick={() => onCancel(proposal.id)}
                                            disabled={pending['cancel']}
                                            className="button"
                                        >
                                            {pending['cancel'] ? '✖ Canceling' : '✖ Cancel'}
                                        </button>
                                    }
                                    <button
                                        onClick={() => {
                                            if (proposal.status === EStatus.QUEUED) {
                                                onExecute(proposal.id)
                                            } else {
                                                onSign(proposal.id)
                                            }
                                        }}
                                        disabled={proposal.status === EStatus.CANCELLED
                                        || proposal.status === EStatus.EXECUTED
                                        || pending['sign']
                                        || pending['execute']
                                        }
                                        className="button">
                                        {
                                            proposal.status === EStatus.QUEUED
                                                ? (pending['sign'] ? '▶ Executing' : '▶ Execute')
                                                : (pending['sign'] ? '✎ Signing' : '✎ Sign')
                                        }
                                    </button>
                                </td>
                            </tr>
                        )
                    })
                }
                </tbody>
            </table>
        </div>
    );
}

export default ProposalsTable;