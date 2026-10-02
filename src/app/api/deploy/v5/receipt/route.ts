import {NextResponse} from "next/server";
import {createPublicClient, http} from "viem";
import {robinhoodChain} from "@/lib/chain";
import {DEPLOY_BYTECODE} from "@/lib/deploy-artifacts";
import {V5_CONFIG} from "@/lib/v5-deployment-config";
import {V5_LEGACY_BYTECODE} from "@/lib/v5-legacy-artifacts";
import {buildV5Transaction, parseV5Progress, readV5Receipt, V5_STEPS, V5_WALLET_GAS_LIMIT} from "@/lib/v5-deployment";
import {type EthereumProvider} from "@/lib/ethereum-provider";

export const dynamic = "force-dynamic";
const publicClient = () => createPublicClient({chain: robinhoodChain, transport: http(process.env.RPC_URL?.trim() || robinhoodChain.rpcUrls.default.http[0], {timeout: 8000, retryCount: 0})});

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("step");
  const step = V5_STEPS.find(step => step.id === id && (id === "routerFactory" || id === "executor"));
  if (!step) return NextResponse.json({error: "Choose routerFactory or executor."}, {status: 400});
  try {
    const transaction = buildV5Transaction(step.id, {}, V5_CONFIG, DEPLOY_BYTECODE);
    const estimated = await publicClient().estimateGas({account: transaction.from, data: transaction.data});
    return NextResponse.json({estimatedGas: estimated.toString(), gasLimit: V5_WALLET_GAS_LIMIT.toString(), fitsWalletLimit: estimated <= V5_WALLET_GAS_LIMIT}, {headers: {"Cache-Control": "no-store"}});
  } catch {return NextResponse.json({error: "Server gas estimate unavailable. Use the connected wallet estimate."}, {status: 503});}
}

export async function POST(request: Request) {
  let input: {id?: unknown; progress?: unknown};
  try {
    const text = await request.text();
    if (text.length > 8192) throw new Error("Too large");
    input = JSON.parse(text);
  } catch {return NextResponse.json({error: "Invalid receipt request."}, {status: 400});}
  const step = V5_STEPS.find(step => step.id === input?.id);
  if (!step) return NextResponse.json({error: "Unknown deployment step."}, {status: 400});
  let progress;
  try {progress = parseV5Progress(input.progress);}
  catch {return NextResponse.json({error: "Invalid deployment progress."}, {status: 400});}
  if (!progress[step.id]) return NextResponse.json({error: "No transaction hash saved."}, {status: 400});
  const client = publicClient();
  // Only the fixed read methods in readV5Receipt run here. No signing or generic RPC forwarding.
  const provider = {request: args => client.request(args as Parameters<typeof client.request>[0])} as EthereumProvider;
  try {
    const check = await readV5Receipt(provider, step.id, progress, V5_CONFIG, DEPLOY_BYTECODE, V5_LEGACY_BYTECODE);
    return NextResponse.json(check, {headers: {"Cache-Control": "no-store"}});
  } catch {
    // RPC errors can contain private transport URLs. The wallet read remains available as fallback.
    return NextResponse.json({error: "Server receipt check unavailable. Checking through your wallet."}, {status: 503});
  }
}
