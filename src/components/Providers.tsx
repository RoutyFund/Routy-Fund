"use client";
import {PrivyProvider} from "@privy-io/react-auth";
import {defineChain} from "viem";

const robinhood=defineChain({
 id:4663,
 name:"Robinhood Chain",
 nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},
 rpcUrls:{default:{http:[process.env.NEXT_PUBLIC_RPC_URL||"https://rpc.mainnet.chain.robinhood.com"]}},
 blockExplorers:{default:{name:"Blockscout",url:"https://robinhoodchain.blockscout.com"}}
});

export default function Providers({children}:{children:React.ReactNode}){
 const appId=process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
 if(!appId)return <>{children}</>;
 return <PrivyProvider appId={appId} config={{
  loginMethods:["wallet"],
  appearance:{theme:"light",accentColor:"#1a6fd1",walletChainType:"ethereum-only"},
  defaultChain:robinhood,
  supportedChains:[robinhood],
  embeddedWallets:{ethereum:{createOnLogin:"off"}}
 }}>{children}</PrivyProvider>;
}
