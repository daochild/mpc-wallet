import {AxiosResponse} from "axios";

export const apiKey = '4FWUBS33WY23N5PKMD64AC75XGS88R27XN'

export const baseAPI: {[chainId: string]: string} = {
    '56': 'https://api.bscscan.com',
    '97': 'https://api-testnet.bscscan.com',
}

export const handle = (promise: Promise<AxiosResponse<any>>) => {
    return promise
        .then(data => ([data, undefined]))
        .catch(error => Promise.resolve([undefined, error]));
}