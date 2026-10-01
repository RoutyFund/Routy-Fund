import {NextResponse} from "next/server";import {createPublicClient,http} from "viem";import {PONS_V2,factoryReadAbi} from "@/lib/pons";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
export async function GET(){try{
 const c=createPublicClient({chain,transport:http()});
 const [launchFee,maxCreatorTaxBps,count]=await Promise.all([
  c.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"launchFee"}),
  c.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"maxCreatorTaxBps"}),
  c.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"launchConfigCount"})
 ]);
 const configs=[] as Array<{id:number;enabled:boolean;supply:string;curveFeeBps:string}>;
 for(let i=0n;i<count;i++){const x=await c.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchConfig",args:[i]});configs.push({id:Number(i),enabled:x.enabled,supply:x.supply.toString(),curveFeeBps:x.curveFeeBps.toString()})}
 return NextResponse.json({ok:true,chainId:4663,factory:PONS_V2.factory,launchFee:launchFee.toString(),maxCreatorTaxBps:maxCreatorTaxBps.toString(),configs});
}catch{return NextResponse.json({ok:false,chainId:4663,factory:PONS_V2.factory,error:"PONS_RPC_UNAVAILABLE"},{status:503})}}