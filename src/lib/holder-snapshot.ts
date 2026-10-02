import {createPublicClient,http,isAddress,type Address} from "viem";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const ZERO="0x0000000000000000000000000000000000000000";

export type HolderRow={address:Address;balance:bigint};

export async function snapshotTokenHolders(input:{
 token:string;
 fromBlock:bigint;
 toBlock?:bigint;
 excluded?:readonly string[];
 rpcUrl?:string;
}):Promise<HolderRow[]>{
 if(!isAddress(input.token))throw new Error("INVALID_TOKEN");
 const client=createPublicClient({chain,transport:http(input.rpcUrl?.trim()||chain.rpcUrls.default.http[0])});
 const chainLatest=await client.getBlockNumber();
 const latest=input.toBlock!==undefined&&input.toBlock<chainLatest?input.toBlock:chainLatest;
 if(input.fromBlock>latest)return [];
 const balances=new Map<string,{address:Address;balance:bigint}>();
 const blocked=new Set([ZERO,...(input.excluded||[])].map(x=>x.toLowerCase()));
 const chunk=20_000n;

 for(let start=input.fromBlock;start<=latest;start+=chunk){
  const end=start+chunk-1n>latest?latest:start+chunk-1n;
  const logs=await client.getLogs({address:input.token as Address,event:{type:"event",name:"Transfer",inputs:[{indexed:true,name:"from",type:"address"},{indexed:true,name:"to",type:"address"},{indexed:false,name:"value",type:"uint256"}]},fromBlock:start,toBlock:end});
  for(const log of logs){
   const from=log.args.from as Address|undefined,to=log.args.to as Address|undefined,value=log.args.value as bigint|undefined;
   if(!from||!to||value===undefined)continue;
   const fk=from.toLowerCase(),tk=to.toLowerCase();
   if(fk!==ZERO){
    const prev=balances.get(fk)?.balance??0n;
    balances.set(fk,{address:from,balance:prev>=value?prev-value:0n});
   }
   if(tk!==ZERO){
    const prev=balances.get(tk)?.balance??0n;
    balances.set(tk,{address:to,balance:prev+value});
   }
  }
 }
 return [...balances.values()].filter(x=>x.balance>0n&&!blocked.has(x.address.toLowerCase())).sort((a,b)=>a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
}
