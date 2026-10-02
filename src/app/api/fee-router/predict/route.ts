import {publicErrorMessage} from "@/lib/public-error";
import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,http,isAddress,type Address,type Hex} from "viem";
import {requireCurrentDeployment} from "@/lib/active-deployment";

export const dynamic="force-dynamic";
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const factoryAbi=[{type:"function",name:"predictRouter",stateMutability:"view",inputs:[{name:"creator",type:"address"},{name:"salt",type:"bytes32"}],outputs:[{name:"predicted",type:"address"}]}] as const;

export async function POST(req:NextRequest){
 try{
  const body=await req.json() as {creator?:string;salt?:string};
  if(!body.creator||!isAddress(body.creator)||!body.salt||!/^0x[0-9a-fA-F]{64}$/.test(body.salt))return NextResponse.json({ok:false,error:"INVALID_REQUEST"},{status:400});
  const rpc=process.env.RPC_URL?.trim();
  const deployment=requireCurrentDeployment();
  const factory=deployment.version==="V5"?deployment.routerFactory:"";
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
  if(!factory||!isAddress(factory))return NextResponse.json({ok:false,error:"V5_FACTORY_NOT_CONFIGURED"},{status:503});
  const client=createPublicClient({chain,transport:http(rpc)});
  const router=await client.readContract({address:factory as Address,abi:factoryAbi,functionName:"predictRouter",args:[body.creator as Address,body.salt as Hex]});
  return NextResponse.json({ok:true,router,salt:body.salt});
 }catch(error){return NextResponse.json({ok:false,error:"ROUTER_PREDICTION_FAILED",message:publicErrorMessage(error)},{status:503})}
}
