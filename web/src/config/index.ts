import MulticallAbi from './abi/Multicall.json'
import MultisigAbi from './abi/Multisig.json'
import SafeStorageAbi from './abi/SafeStorage.json'
import TimelockAbi from './abi/Timelock.json'

// BSC chainId = 56
// BSCTestNet chainId = 97
export const defaultChainId = parseInt(process.env.REACT_APP_CHAIN_ID || '56');
export const storageConnectorKey = 'proposal_connector'

type AddressByChaind = {[chainId: string]: string}

const safeStorageAddress: AddressByChaind = {
    '56': '0xe5a65aee2E66178432d3f71984761514856D8f6E',
    '97': '0x64320DDB7A84E95E82B25A7727d3D514EBE397cE',
};
const timelockAddress: AddressByChaind = {
    '56': '0xc6f9973c41e84451C4366e874F0C9F5Cdb2342ed',
    '97': '0xa3f6dD5c4753c7F0BFE661055329c0B9D3103b2F',
};
const multisigAddress: AddressByChaind = {
    '56': '0x535eef3bf36C74Eb9d235Ef4F1bb551C12F91222',
    '97': '0x25A37D08341d90d2deAe5096dE029DE12727daA0',
};
const multicallAddress: AddressByChaind = {
    56: '0xfF6FD90A470Aaa0c1B8A54681746b07AcdFedc9B',
    97: '0xE226fe842b0A986c86f18c9Fd1A751CAb28bc951',
};

export {
    timelockAddress,
    safeStorageAddress,
    multisigAddress,
    multicallAddress,
    MulticallAbi,
    MultisigAbi,
    SafeStorageAbi,
    TimelockAbi
}