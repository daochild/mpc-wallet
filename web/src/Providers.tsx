import {Web3ReactProvider} from '@web3-react/core';
import React from 'react';
import {getLibrary} from "./util/web3React";
import AlertProvider from "./contexts/AlertProvider";

interface Props {
    children: React.ReactNode
}

function Providers({children}: Props) {
    return (
        <Web3ReactProvider getLibrary={getLibrary}>
            <AlertProvider>
                {children}
            </AlertProvider>
        </Web3ReactProvider>
    );
}

export default Providers;