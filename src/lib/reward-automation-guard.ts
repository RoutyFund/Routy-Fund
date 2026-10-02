import {createPublicClient,http,type Hex} from "viem";
import {requireCurrentDeployment} from "@/lib/active-deployment";
import {privateKeyToAccount} from "viem/accounts";

const chain={id:4663,name:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:{default:{http:["https://rpc.mainnet.chain.robinhood.com"]}}} as const;
const abi=[
 {type:"function",name:"owner",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
 {type:"function",name:"keeper",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
 {type:"function",name:"paused",stateMutability:"view",inputs:[],outputs:[{type:"bool"}]},
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
 const deployment=requireCurrentDeployment();
 const controller=deployment.controller as `0x${string}`;
 const [owner,keeper,executorPaused]=await Promise.all([
  client.readContract({address:controller,abi,functionName:"owner"}),
  client.readContract({address:controller,abi,functionName:"keeper"}),
  client.readContract({address:deployment.executor as `0x${string}`,abi,functionName:"paused"}),
 ]);
 const account=keeperAccount();
 return {
  owner,keeper,
  configuredKeeper:account?.address??null,
  keeperSecretConfigured:Boolean(account),
  keeperMatches:Boolean(account&&account.address.toLowerCase()===keeper.toLowerCase()),
  // A signer must match the selected deployment's controller keeper.
  automationEnabled:Boolean(account&&account.address.toLowerCase()===keeper.toLowerCase()),
  swapExecutionEnabled:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true",
  executorPaused,
  swapExecutionActive:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true"&&!executorPaused,
  generation:deployment.version.toLowerCase(),
  rpcConfigured:Boolean(process.env.RPC_URL?.trim()),
  cronSecretConfigured:Boolean(process.env.CRON_SECRET?.trim()),
 };
}
