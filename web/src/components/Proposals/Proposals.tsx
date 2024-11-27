import React from 'react';
import classes from './Proposals.module.scss';
import ProposalsTable from "../ProposalsTable/ProposalsTable";

function Proposals() {
    return (
        <div className={['container', classes.Proposals].join(' ')}>
            <div className="card">
                <h2 className="card-title">Proposals</h2>
                <ProposalsTable/>
            </div>
        </div>
    );
}

export default Proposals;