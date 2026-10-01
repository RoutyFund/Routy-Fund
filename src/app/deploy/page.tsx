"use client";

import Nav from "@/components/Nav";
import { useEffect, useState } from "react";
import { formatEther } from "viem";

const DEPLOYER = "0x866d5D863381efe9e10cCb2E44f388611F781212";
const TREASURY = "0xdA8ffb66f37E940c894Ea9ec3DCeEd858d81a4b0";

export default function DeployPage() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("0");

  async function refresh() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const accounts = await eth.request({ method: "eth_accounts" });
    const chain = await eth.request({ method: "eth_chainId" });
    setAccount(accounts?.[0] ?? "");
    setChainId(chain ?? "");
    if (accounts?.[0]) {
      const hex = await eth.request({
        method: "eth_getBalance",
        params: [accounts[0], "latest"],
      });
      setBalance(formatEther(BigInt(hex)));
    }
  }

  async function connect() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    await eth.request({ method: "eth_requestAccounts" });
    await refresh();
  }

  async function switchChain() {
    const eth = (window as any).ethereum;
    if (!eth) return;
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1237" }],
    });
    await refresh();
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const authorized = account.toLowerCase() === DEPLOYER.toLowerCase();
  const correctChain = chainId.toLowerCase() === "0x1237";

  return (
    <main className="shell">
      <Nav />
      <div className="wrap">
        <span className="kicker">Routy deployment console</span>
        <h1 style={{ fontSize: 56 }}>Mobile deployment</h1>
        <p className="muted">
          Connect the authorized deployer wallet on Robinhood Chain. This page
          never requests or stores a private key.
        </p>

        <div className="launch-form">
          <div className="form-card">
            <h2>Deployer</h2>
            <div className="notice">{DEPLOYER}</div>
            <p>Connected: <b>{account || "Not connected"}</b></p>
            <p>Gas balance: <b>{balance} ETH</b></p>
            {!account ? (
              <button className="primary" onClick={connect}>Connect wallet</button>
            ) : !correctChain ? (
              <button className="primary" onClick={switchChain}>Switch to Robinhood Chain</button>
            ) : (
              <div className="notice">
                {authorized
                  ? "Authorized deployer connected. Deployment transactions will be enabled after final contract artifacts are published."
                  : "Wrong wallet. Connect the authorized deployer."}
              </div>
            )}
          </div>

          <div className="form-card">
            <h2>Production config</h2>
            <p>Treasury: <b>{TREASURY}</b></p>
            <p>Network: <b>Robinhood Chain (4663)</b></p>
            <p>Fee split: <b>80% Asset Vault / 20% Treasury</b></p>
            <div className="notice">
              Deployment is still locked until the final contract test artifact is attached to this console.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
