import {NextResponse} from "next/server";
import {createPublicClient, http} from "viem";
import {robinhoodChain} from "@/lib/chain";
import {DEPLOY_BYTECODE} from "@/lib/deploy-artifacts";
import {V5_CONFIG} from "@/lib/v5-deployment-config";
import {parseV5Progress, readV5Receipt, V5_STEPS} from "@/lib/v5-deployment";
import {type EthereumProvider} from "@/lib/ethereum-provider";

export const dynamic = "force-dynamic";
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
  const client = createPublicClient({chain: robinhoodChain, transport: http(process.env.RPC_URL?.trim() || robinhoodChain.rpcUrls.default.http[0], {timeout: 8000, retryCount: 0})});
  // Only the fixed read methods in readV5Receipt run here. No signing or generic RPC forwarding.
  const provider = {request: args => client.request(args as Parameters<typeof client.request>[0])} as EthereumProvider;
  try {
    const check = await readV5Receipt(provider, step.id, progress, V5_CONFIG, DEPLOY_BYTECODE);
    return NextResponse.json(check, {headers: {"Cache-Control": "no-store"}});
  } catch {
    // RPC errors can contain private transport URLs. The wallet read remains available as fallback.
    return NextResponse.json({error: "Server receipt check unavailable. Checking through your wallet."}, {status: 503});
  }
}
