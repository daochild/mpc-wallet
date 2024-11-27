import {UnsupportedChainIdError, useWeb3React} from "@web3-react/core";
import {useCallback} from "react";
import {defaultChainId, storageConnectorKey} from "../config";
import {ConnectorNames, connectorsByName} from "../util/web3React";
import {setupNetwork} from "../util/wallet";
import {useAlert} from "./useAlert";
import {classAlert} from "../contexts/AlertProvider";

function useAuth() {
    const {activate, deactivate} = useWeb3React()
    const {showAlert} = useAlert()
    const defaultConnectorKey = window.localStorage.getItem(storageConnectorKey) || ConnectorNames.Injected

    const login = useCallback((connectorKey: ConnectorNames | string = defaultConnectorKey) => {
        const connector: any = connectorsByName[connectorKey]
        if (connector) {
            activate(connector, async (error) => {
                console.log(error.message || error )
                if (error instanceof UnsupportedChainIdError) {
                    const hasSetup = await setupNetwork(defaultChainId)
                    if (hasSetup) {
                        activate(connector)
                        showAlert({text: 'Change Network: Success', cls: classAlert.success})
                    } else {
                        showAlert({text: error.message, cls: classAlert.error})
                    }
                }
            })
        } else {
            console.info('Connector is Failed')
        }
    }, [activate, defaultConnectorKey, showAlert])

    const logout = useCallback(() => {
        deactivate();
    }, [deactivate])

    return {
        login,
        logout
    }
}

export default useAuth;