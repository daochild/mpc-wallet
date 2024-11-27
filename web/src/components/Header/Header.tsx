import React, {useCallback} from 'react';
import classes from './Header.module.scss';
import {useWeb3React} from "@web3-react/core";
import {shortAddress} from "../../util";
import useAuth from "../../hooks/useAuth";

function Header() {

    const {account} = useWeb3React()
    const {login} = useAuth()

    const onLogin = useCallback(() => {
        if (!account) {
            login()
        }
    }, [account, login])

    return (
        <div className={['container', classes.Header].join(' ')}>
            <button onClick={onLogin} className="button">{account ? shortAddress(account) : 'Connect'}</button>
        </div>
    );
}

export default Header;