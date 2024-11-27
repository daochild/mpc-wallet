import {useWeb3React} from "@web3-react/core";
import {useEffect, useState} from "react";

function useBlockNumber(): number {
    const [blockNumber, setBlockNumber] = useState<number>(0);
    const {library} = useWeb3React()

    useEffect(() => {
        if (library) {
            let interval = setInterval(() => {
                library.getBlockNumber()
                    .then((res: any) => {
                        setBlockNumber(res)
                    })
                    .catch((e: any) => {
                        console.info(e.message || e)
                    })
            }, 15000)
            return () => {
                clearInterval(interval)
            }
        }
    }, [library, setBlockNumber])
    return blockNumber
}

export default useBlockNumber;