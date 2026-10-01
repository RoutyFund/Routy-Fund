"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getInjectedProvider } from "@/lib/ethereum-provider";

export default function Nav() {
  const [account, setAccount] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      getInjectedProvider()?.request<string[]>({ method: "eth_accounts" })
        .then((accounts) => setAccount(accounts?.[0] || ""))
        .catch(() => {});
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function connect() {
    const provider = getInjectedProvider();
    if (!provider) {
      window.alert("Install a compatible EVM wallet.");
      return;
    }
    try {
      const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
      try {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1237" }] });
      } catch {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x1237",
              chainName: "Robinhood Chain",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
              blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
            }],
          });
        } catch {}
      }
      setAccount(accounts?.[0] || "");
    } catch {}
  }

  return (
    <nav className="nav">
      <Link className="brand" href="/"><span className="logo">R</span><span>Routy</span></Link>
      <div className="navlinks">
        <Link href="/explore">Explore</Link>
        <Link href="/assets">Assets</Link>
        <Link href="/rewards">Rewards</Link>
        <Link href="/activity">Activity</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/portfolio">Portfolio</Link>
      </div>
      <button className="wallet" onClick={connect}>{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect wallet"}</button>
    </nav>
  );
}
