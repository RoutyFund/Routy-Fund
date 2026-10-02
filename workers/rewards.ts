import {keccak256,encodeAbiParameters,parseAbiParameters} from "viem";
import {eligible,type SnapshotBalance} from "./snapshot";
export type Holder=SnapshotBalance;
export type Allocation={address:`0x${string}`;amount:bigint};

export function proRata(holders:Holder[],amount:bigint,excluded:readonly string[]=[]):Allocation[]{
 const xs=eligible(holders,excluded);
 const total=xs.reduce((n,h)=>n+h.balance,0n);
 if(total===0n||amount===0n)return[];
 let allocated=0n;
 return xs.map((h,i)=>{
  const share=i===xs.length-1?amount-allocated:amount*h.balance/total;
  allocated+=share;
  return{address:h.address,amount:share};
 }).filter(x=>x.amount>0n);
}
export function equalSplit(holders:Holder[],amount:bigint,excluded:readonly string[]=[]):Allocation[]{
 const xs=eligible(holders,excluded);
 if(!xs.length||amount===0n)return[];
 const each=amount/BigInt(xs.length);
 let allocated=0n;
 return xs.map((h,i)=>{
  const share=i===xs.length-1?amount-allocated:each;
  allocated+=share;
  return{address:h.address,amount:share};
 }).filter(x=>x.amount>0n);
}
export function leaf(address:`0x${string}`,cumulativeAmount:bigint){const inner=keccak256(encodeAbiParameters(parseAbiParameters("address,uint256"),[address,cumulativeAmount]));return keccak256(inner)}
