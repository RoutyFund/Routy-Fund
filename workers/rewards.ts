import {keccak256,encodeAbiParameters,parseAbiParameters} from "viem";
export type Holder={address:`0x${string}`,balance:bigint};
export function proRata(holders:Holder[],amount:bigint){const total=holders.reduce((n,h)=>n+h.balance,0n);if(total===0n)return[];return holders.filter(h=>h.balance>0n).map(h=>({address:h.address,amount:amount*h.balance/total}))}
export function leaf(address:`0x${string}`,cumulativeAmount:bigint){const inner=keccak256(encodeAbiParameters(parseAbiParameters("address,uint256"),[address,cumulativeAmount]));return keccak256(inner)}