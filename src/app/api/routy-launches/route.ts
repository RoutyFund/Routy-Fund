import {publicErrorMessage} from "@/lib/public-error";
import {contractCreationBlock} from "@/lib/contract-history";
import {NextResponse} from "next/server";
import {requireCurrentDeployment} from "@/lib/active-deployment";
import {createPublicClient,http,parseAbiItem,type Address} from "viem";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const routeEventV4=parseAbiItem("event RouteProvisionedV4(address indexed token,address indexed creator,address indexed targetAsset,address vault,address router,address distributor,address quoteToken,uint8 policy,address provisionedBy)");
const routeEventV5=parseAbiItem("event RouteProvisionedV5(address indexed token,address indexed creator,address indexed targetAsset,address vault,address router,address distributor,address quoteToken,uint8 policy,address provisionedBy)");
export const dynamic="force-dynamic";
const erc20Abi=[
 {type:"function",name:"name",stateMutability:"view",inputs:[],outputs:[{type:"string"}]},
 {type:"function",name:"symbol",stateMutability:"view",inputs:[],outputs:[{type:"string"}]},
] as const;

export async function GET(){
 try{
  const rpc=process.env.RPC_URL?.trim()||process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING",launches:[]},{status:503});
  const client=createPublicClient({chain,transport:http(rpc)});
  const deployment=requireCurrentDeployment();
  const launcher=deployment.launcher as Address;
  const routeEvent=deployment.version==="V5"?routeEventV5:routeEventV4;
  const latest=await client.getBlockNumber();
  const fromBlock=await contractCreationBlock(client,launcher,latest);
  const historyComplete=true;
  const logs=[];
  const chunk=10000n;
  for(let start=fromBlock;start<=latest;start+=chunk){
   const end=start+chunk-1n>latest?latest:start+chunk-1n;
   const part=await client.getLogs({address:launcher,event:routeEvent,fromBlock:start,toBlock:end});
   logs.push(...part);
  }
  const logoRows=await fetch("https://hcwtwtvovdzfuugnjqyz.supabase.co/rest/v1/route_setup_queue?select=token_address,logo_url",{headers:(()=>{const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();return key?(key.startsWith("sb_")?{apikey:key}:{apikey:key,Authorization:"Bearer "+key}):{}})(),cache:"no-store"}).then(async r=>r.ok?await r.json() as Array<{token_address:string;logo_url:string|null}>:[]).catch(()=>[]);
  const logos=new Map(logoRows.map(row=>[row.token_address.toLowerCase(),row.logo_url]));
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
    logo:logos.get(token.toLowerCase())||null,
    creator:log.args.creator,
    targetAsset,
    targetSymbol:route?.symbol??"UNKNOWN",
    targetName:route?.name??"Unknown market",
    quoteToken:log.args.quoteToken,
    vault:log.args.vault,
    router:log.args.router,
    distributor:log.args.distributor,
    policy:Number(log.args.policy??0),
    ponsPhase:pons?Number(pons.phase):null,
    creatorTaxBps:pons?Number(pons.creatorTaxBps):null,
    createdAt:block?Number(block.timestamp):null,
    blockNumber:Number(log.blockNumber),
    provisionBlock:Number(log.blockNumber),
    transactionHash:log.transactionHash,
   };
  }));
  return NextResponse.json({ok:true,chainId:4663,generation:deployment.version.toLowerCase(),launcher,count:launches.length,historyComplete,scannedFrom:Number(fromBlock),scannedTo:Number(latest),launches});
 }catch(error){
  return NextResponse.json({ok:false,error:"ROUTY_LAUNCHES_UNAVAILABLE",detail:publicErrorMessage(error),launches:[]},{status:503});
 }
}
