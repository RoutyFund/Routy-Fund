import {createPublicClient,http,isAddress,type Address} from "viem";
import {applyHolderTransfers} from "@/lib/holder-balances";

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
 const rpc=input.rpcUrl?.trim();
 if(!rpc)throw new Error("RPC_URL_MISSING");
 const client=createPublicClient({chain,transport:http(rpc)});
 const chainLatest=await client.getBlockNumber();
 const latest=input.toBlock!==undefined&&input.toBlock<chainLatest?input.toBlock:chainLatest;
 if(input.fromBlock>latest)return [];
 const balances=new Map<string,{address:Address;balance:bigint}>();
 const blocked=new Set([ZERO,...(input.excluded||[])].map(x=>x.toLowerCase()));
 const chunk=20_000n;

 for(let start=input.fromBlock;start<=latest;start+=chunk){
  const end=start+chunk-1n>latest?latest:start+chunk-1n;
  const logs=await client.getLogs({address:input.token as Address,event:{type:"event",name:"Transfer",inputs:[{indexed:true,name:"from",type:"address"},{indexed:true,name:"to",type:"address"},{indexed:false,name:"value",type:"uint256"}]},fromBlock:start,toBlock:end});
  const transfers=[];
  for(const log of logs){
   const from=log.args.from as Address|undefined,to=log.args.to as Address|undefined,value=log.args.value as bigint|undefined;
   if(!from||!to||value===undefined)continue;
   transfers.push({from,to,value});
  }
  applyHolderTransfers(balances,transfers);
 }
 const supply=await client.readContract({address:input.token as Address,abi:[{type:"function",name:"totalSupply",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]}],functionName:"totalSupply",blockNumber:latest});
 if([...balances.values()].reduce((sum,row)=>sum+row.balance,0n)!==supply)throw new Error("INCOMPLETE_TRANSFER_HISTORY");
 return [...balances.values()].filter(x=>x.balance>0n&&!blocked.has(x.address.toLowerCase())).sort((a,b)=>a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
}
