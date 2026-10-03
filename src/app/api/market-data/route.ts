import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,formatUnits,http,isAddress,type Address} from "viem";
import {PONS_V2,factoryReadAbi} from "@/lib/pons";

export const dynamic="force-dynamic";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const erc20Abi=[
 {type:"function",name:"totalSupply",stateMutability:"view",inputs:[],outputs:[{type:"uint256"}]},
 {type:"function",name:"decimals",stateMutability:"view",inputs:[],outputs:[{type:"uint8"}]},
] as const;
const curveAbi=[
 {type:"function",name:"getReserves",stateMutability:"view",inputs:[],outputs:[{name:"quoteReserve_",type:"uint256"},{name:"tokenReserve_",type:"uint256"}]},
] as const;

type Market={token:string;priceUsd:string|null;marketCapUsd:string|null;source:string;phase:number|null;updatedAt:number};

function finiteNumber(value:unknown){
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value==="string"&&value.trim()&&Number.isFinite(Number(value)))return Number(value);
 return null;
}
function findNumber(value:unknown,keys:string[]):number|null{
 if(!value||typeof value!=="object")return null;
 const object=value as Record<string,unknown>;
 for(const key of keys){
  const found=finiteNumber(object[key]);
  if(found!==null)return found;
 }
 for(const nested of ["market","stats","data","result","token","launch","pricing"]){
  const found=findNumber(object[nested],keys);
  if(found!==null)return found;
 }
 return null;
}
async function ponsMarket(token:string):Promise<{price:number|null;mcap:number|null}|null>{
 const roots=["https://api.pons.family/api"];
 const paths=[`/tokens/${token}`,`/token/${token}`,`/launches/${token}`];
 for(const root of roots)for(const path of paths){
  try{
   const response=await fetch(root+path,{cache:"no-store",signal:AbortSignal.timeout(1800)});
   if(!response.ok)continue;
   const data=await response.json();
   const price=findNumber(data,["priceUsd","priceUSD","usdPrice","currentPriceUsd","currentPrice","price"]);
   const mcap=findNumber(data,["marketCapUsd","marketCapUSD","marketCap","market_cap","mcap","fdvUsd","fdv"]);
   if(price!==null||mcap!==null)return {price,mcap};
  }catch{}
 }
 return null;
}
function decimalString(value:number|null){
 if(value===null||!Number.isFinite(value)||value<0)return null;
 if(value===0)return "0";
 if(value>=1)return value.toFixed(8).replace(/0+$/,"").replace(/\.$/,"");
 return value.toPrecision(8).replace(/0+$/,"").replace(/\.$/,"");
}
async function readOne(client:ReturnType<typeof createPublicClient>,token:Address):Promise<Market>{
 const now=Date.now();
 const launch=await client.readContract({address:PONS_V2.factory,abi:factoryReadAbi,functionName:"getLaunchedToken",args:[token]});
 if(!launch.exists)return {token,priceUsd:null,marketCapUsd:null,source:"not-pons",phase:null,updatedAt:now};
 const phase=Number(launch.phase);
 const external=await ponsMarket(token);
 if(external){
  let mcap=external.mcap;
  if(mcap===null&&external.price!==null){
   const [supply,decimals]=await Promise.all([
    client.readContract({address:token,abi:erc20Abi,functionName:"totalSupply"}),
    client.readContract({address:token,abi:erc20Abi,functionName:"decimals"}),
   ]);
   mcap=external.price*Number(formatUnits(supply,decimals));
  }
  if(external.price!==null||mcap!==null)return {token,priceUsd:decimalString(external.price),marketCapUsd:decimalString(mcap),source:"pons",phase,updatedAt:now};
 }
 try{
  const [supply,tokenDecimals,quoteDecimals,reserves]=await Promise.all([
   client.readContract({address:token,abi:erc20Abi,functionName:"totalSupply"}),
   client.readContract({address:token,abi:erc20Abi,functionName:"decimals"}),
   client.readContract({address:launch.pairToken as Address,abi:erc20Abi,functionName:"decimals"}),
   client.readContract({address:launch.curve as Address,abi:curveAbi,functionName:"getReserves"}),
  ]);
  const quote=Number(formatUnits(reserves[0],quoteDecimals));
  const tokens=Number(formatUnits(reserves[1],tokenDecimals));
  const totalSupply=Number(formatUnits(supply,tokenDecimals));
  const price=tokens>0?quote/tokens:null;
  const mcap=price!==null?price*totalSupply:null;
  return {token,priceUsd:decimalString(price),marketCapUsd:decimalString(mcap),source:"pons-onchain",phase,updatedAt:now};
 }catch{
  return {token,priceUsd:null,marketCapUsd:null,source:"unavailable",phase,updatedAt:now};
 }
}

export async function GET(req:NextRequest){
 const raw=(req.nextUrl.searchParams.get("tokens")||"").split(",").map(x=>x.trim()).filter(Boolean);
 const tokens=[...new Set(raw)].slice(0,50);
 if(!tokens.length||tokens.some(token=>!isAddress(token)))return NextResponse.json({ok:false,error:"INVALID_TOKENS"},{status:400});
 const rpc=process.env.RPC_URL?.trim()||process.env.NEXT_PUBLIC_RPC_URL?.trim();
 if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
 const client=createPublicClient({chain,transport:http(rpc)});
 const markets=await Promise.all(tokens.map(token=>readOne(client,token as Address)));
 return NextResponse.json({ok:true,markets,refreshMs:3000},{headers:{"Cache-Control":"public, max-age=0, s-maxage=2, stale-while-revalidate=2"}});
}
