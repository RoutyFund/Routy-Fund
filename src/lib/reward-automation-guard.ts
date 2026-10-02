import {createPublicClient,http,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {ROUTY_DEPLOYMENT} from "@/lib/deployment";

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
 const rpc=process.env.RPC_URL?.trim()||chain.rpcUrls.default.http[0];
 const client=createPublicClient({chain,transport:http(rpc)});
 const [owner,keeper]=await Promise.all([
  client.readContract({address:ROUTY_DEPLOYMENT.rewardAutomationControllerV4,abi,functionName:"owner"}),
  client.readContract({address:ROUTY_DEPLOYMENT.rewardAutomationControllerV4,abi,functionName:"keeper"}),
 ]);
 const account=keeperAccount();
 return {
  owner,keeper,
  configuredKeeper:account?.address??null,
  keeperSecretConfigured:Boolean(account),
  keeperMatches:Boolean(account&&account.address.toLowerCase()===keeper.toLowerCase()),
  automationEnabled:process.env.ROUTY_REWARD_AUTOMATION_ENABLED==="true",
  swapExecutionEnabled:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true",
 };
}
