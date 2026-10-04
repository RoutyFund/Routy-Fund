import {NextResponse} from "next/server";
import {createPublicClient,http,type Address} from "viem";
import {contractCreationBlock} from "@/lib/contract-history";
import {PONS_V2,factoryLaunchAbi} from "@/lib/pons";

export const dynamic="force-dynamic";

const DEV_WALLET="0xAeAEAF0adEF3BD65ab7c5cD4611437C0cE1f9F4e" as Address;
const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:[process.env.RPC_URL||process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const tokenLaunched=factoryLaunchAbi.find(item=>item.type==="event"&&item.name==="TokenLaunched")!;

export async function GET(){
 try{
  const rpc=process.env.RPC_URL?.trim()||process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if(!rpc)return NextResponse.json({ok:false,error:"RPC_URL_MISSING",token:null},{status:503});
  const client=createPublicClient({chain,transport:http(rpc)});
  const factory=PONS_V2.factory as Address;
  const latest=await client.getBlockNumber();
  const creation=await contractCreationBlock(client,factory,latest);
  const chunk=10000n;

  for(let end=latest;end>=creation;){
   const start=end-chunk+1n>creation?end-chunk+1n:creation;
   const logs=await client.getLogs({
    address:factory,
    event:tokenLaunched,
    args:{deployer:DEV_WALLET},
    fromBlock:start,
    toBlock:end,
   });
   if(logs.length){
    const log=logs[logs.length-1];
    return NextResponse.json({
     ok:true,
     devWallet:DEV_WALLET,
     token:log.args.token??null,
     transactionHash:log.transactionHash,
     blockNumber:Number(log.blockNumber),
    },{headers:{"Cache-Control":"public, max-age=0, s-maxage=10, stale-while-revalidate=10"}});
   }
   if(start===creation)break;
   end=start-1n;
  }

  return NextResponse.json({ok:true,devWallet:DEV_WALLET,token:null},{headers:{"Cache-Control":"public, max-age=0, s-maxage=10, stale-while-revalidate=10"}});
 }catch{
  return NextResponse.json({ok:false,error:"OFFICIAL_TOKEN_SCAN_UNAVAILABLE",token:null},{status:503});
 }
}
