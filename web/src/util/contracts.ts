import {Contract, ethers} from "ethers"
import random from 'lodash/random'
import {defaultChainId} from "../config";

export const nodes: any = {
    56: [
        'https://data-seed-prebsc-1-s1.binance.org:8545',
        'https://data-seed-prebsc-2-s1.binance.org:8545',
        'https://data-seed-prebsc-1-s2.binance.org:8545',
        'https://data-seed-prebsc-2-s2.binance.org:8545',
        'https://data-seed-prebsc-1-s3.binance.org:8545',
        'https://data-seed-prebsc-2-s3.binance.org:8545',
    ],
    97: [
        'https://data-seed-prebsc-1-s1.binance.org:8545',
        'https://data-seed-prebsc-2-s1.binance.org:8545',
        'https://data-seed-prebsc-1-s2.binance.org:8545',
        'https://data-seed-prebsc-2-s2.binance.org:8545',
        'https://data-seed-prebsc-1-s3.binance.org:8545',
        'https://data-seed-prebsc-2-s3.binance.org:8545',
    ]
}
export const getNodeUrl = () => {
    const randomIndex = random(0, nodes[defaultChainId].length - 1)
    return nodes[defaultChainId][randomIndex]
}

const RPC_URL = getNodeUrl();

export const simpleRpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL)

export const getContract = (abi: any, address: string, signer?: ethers.Signer | ethers.providers.Provider): Contract => {
    const signerOrProvider = signer ?? simpleRpcProvider
    return new ethers.Contract(address, abi, signerOrProvider)
}