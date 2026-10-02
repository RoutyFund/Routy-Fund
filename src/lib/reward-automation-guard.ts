import {createPublicClient,http,type Hex} from "viem";
import {requireCurrentDeployment} from "@/lib/active-deployment";
import {privateKeyToAccount} from "viem/accounts";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const abi=[
 {type:"function",name:"owner",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
 {type:"function",name:"keeper",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
] as const;

export function keeperAccount(){
 const value=(process.env.ROUTY_AUTOMATION_PRIVATE_KEY||process.env.KEEPER_PRIVATE_KEY)?.trim();
 if(!value||!/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
 return privateKeyToAccount(value as Hex);
}
export async function rewardAutomationStatus(){
 const rpc=process.env.RPC_URL?.trim();
 if(!rpc)throw new Error("RPC_URL_MISSING");
 const client=createPublicClient({chain,transport:http(rpc)});
 const controller=requireCurrentDeployment().controller as `0x${string}`;
 const [owner,keeper]=await Promise.all([
  client.readContract({address:controller,abi,functionName:"owner"}),
  client.readContract({address:controller,abi,functionName:"keeper"}),
 ]);
 const account=keeperAccount();
 return {
  owner,keeper,
  configuredKeeper:account?.address??null,
  keeperSecretConfigured:Boolean(account),
  keeperMatches:Boolean(account&&account.address.toLowerCase()===keeper.toLowerCase()),
  // V4 automation is enabled when a configured signer actually matches the
  // controller keeper. This avoids stale legacy feature flags blocking V4.
  automationEnabled:Boolean(account&&account.address.toLowerCase()===keeper.toLowerCase()),
  swapExecutionEnabled:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true",
  rpcConfigured:Boolean(process.env.RPC_URL?.trim()),
  cronSecretConfigured:Boolean(process.env.CRON_SECRET?.trim()),
 };
}
