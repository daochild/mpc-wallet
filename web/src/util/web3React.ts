import {InjectedConnector} from '@web3-react/injected-connector'
import {defaultChainId} from "../config";
import {Web3Provider} from "@ethersproject/providers";
import { BscConnector } from '@binance-chain/bsc-connector'
import {ethers} from "ethers";

export enum ConnectorNames {
    Injected = "injected",
    WalletConnect = "walletconnect",
    BSC = "bsc",
}

const POLLING_INTERVAL = 12000
const injected = new InjectedConnector({ supportedChainIds: [defaultChainId] })

const bscConnector = new BscConnector({ supportedChainIds: [56, 97] })

export const connectorsByName: {[connectorName in ConnectorNames | string]: any} = {
    [ConnectorNames.Injected]: injected,
    [ConnectorNames.BSC]: bscConnector,
}

export const getLibrary = (provider: any): Web3Provider => {
    const library = new ethers.providers.Web3Provider(provider)
    library.pollingInterval = POLLING_INTERVAL
    return library
}