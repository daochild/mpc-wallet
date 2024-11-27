import {apiKey, baseAPI} from "./index";
import axios from "axios";
import {defaultChainId} from "../config";

export async function getABI(address: string) {
    console.log(defaultChainId)
    return await axios.get(`${baseAPI[defaultChainId]}/api?module=contract&action=getabi&address=${address}&apikey=${apiKey}`)
}