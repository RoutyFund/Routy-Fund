import {NextResponse} from "next/server";
import {createPublicClient,http,parseAbiItem,type Address} from "viem";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const routeEvent=parseAbiItem("event RouteProvisioned(address indexed token,address indexed creator,address indexed targetAsset,address vault,address router,address quoteToken,uint8 policy)");
const erc20Abi=[
 {type:"function",name:"name",stateMutability:"view",inputs:[],outputs:[{type:"string"}]},
 {type:"function",name:"symbol",stateMutability:"view",inputs:[],outputs:[{type:"string"}]},
] as const;

export async function GET(){
 try{
  const client=createPublicClient({chain,transport:http()});
  const latest=await client.getBlockNumber();
  const configuredRaw=process.env.ROUTY_EVENT_START_BLOCK?.trim();
  if(!configuredRaw){
   return NextResponse.json({ok:false,error:"ROUTY_EVENT_START_BLOCK_REQUIRED",detail:"Set ROUTY_EVENT_START_BLOCK to the verified ProtocolLauncher deployment block before indexing production history.",launches:[]},{status:503});
  }
  let fromBlock:bigint;
  try{fromBlock=BigInt(configuredRaw)}catch{
   return NextResponse.json({ok:false,error:"ROUTY_EVENT_START_BLOCK_INVALID",detail:"ROUTY_EVENT_START_BLOCK must be a non-negative integer block number.",launches:[]},{status:503});
  }
  if(fromBlock<0n||fromBlock>latest){
   return NextResponse.json({ok:false,error:"ROUTY_EVENT_START_BLOCK_INVALID",detail:"ROUTY_EVENT_START_BLOCK is outside the current chain range.",launches:[]},{status:503});
  }
  const logs=[];
  const chunk=10000n;
  for(let start=fromBlock;start<=latest;start+=chunk){
   const end=start+chunk-1n>latest?latest:start+chunk-1n;
   const part=await client.getLogs({address:ROUTY_DEPLOYMENT.protocolLauncher,event:routeEvent,fromBlock:start,toBlock:end});
   logs.push(...part);
  }
  const launches=await Promise.all(logs.reverse().map(async log=>{
   const token=log.args.token as Address;
   const targetAsset=log.args.targetAsset as Address;
   const route=EXECUTABLE_ROUTES.find(r=>r.target.toLowerCase()===targetAsset.toLowerCase());
   const [name,symbol,pons]=await Promise.all([
    client.readContract({address:token,abi:erc20Abi,functionName:"name"}).catch(()=>"Unknown token"),
    client.readContract({address:token,abi:erc20Abi,functionName:"symbol"}).catch(()=>"TOKEN"),
    client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token]}).catch(()=>null),
   ]);
   const block=await client.getBlock({blockNumber:log.blockNumber}).catch(()=>null);
   return {
    token,
    name,
    symbol,
    creator:log.args.creator,
    targetAsset,
    targetSymbol:route?.symbol??"UNKNOWN",
    targetName:route?.name??"Unknown market",
    quoteToken:log.args.quoteToken,
    vault:log.args.vault,
    router:log.args.router,
    policy:Number(log.args.policy??0),
    ponsPhase:pons?Number(pons.phase):null,
    creatorTaxBps:pons?Number(pons.creatorTaxBps):null,
    createdAt:block?Number(block.timestamp):null,
    blockNumber:Number(log.blockNumber),
    transactionHash:log.transactionHash,
   };
  }));
  return NextResponse.json({ok:true,chainId:4663,count:launches.length,scannedFrom:Number(fromBlock),scannedTo:Number(latest),launches});
 }catch(error){
  return NextResponse.json({ok:false,error:"ROUTY_LAUNCHES_UNAVAILABLE",detail:error instanceof Error?error.message:"unknown",launches:[]},{status:503});
 }
}
