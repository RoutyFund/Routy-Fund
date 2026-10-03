"use client";
import {useEffect} from "react";
import {usePrivy,useWallets} from "@privy-io/react-auth";
import {setPrivyProvider,type EthereumProvider} from "@/lib/ethereum-provider";

export default function PrivyWalletBridge(){
 const {authenticated}=usePrivy();
 const {wallets}=useWallets();
 useEffect(()=>{
  const wallet=wallets.find(w=>w.walletClientType!=="privy")||wallets[0];
  let active=true;
  if(!authenticated||!wallet){setPrivyProvider(undefined);return}
  void wallet.getEthereumProvider().then(provider=>{if(active)setPrivyProvider(provider as EthereumProvider)}).catch(()=>{if(active)setPrivyProvider(undefined)});
  return()=>{active=false;setPrivyProvider(undefined)};
 },[authenticated,wallets]);
 return null;
}
