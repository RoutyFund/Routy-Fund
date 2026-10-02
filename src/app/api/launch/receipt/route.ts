import {NextRequest, NextResponse} from "next/server";
import {createPublicClient, decodeEventLog, http, type Hex} from "viem";
import {PONS_V2, factoryLaunchAbi} from "@/lib/pons";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("hash") || "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return NextResponse.json({ok:false,error:"INVALID_TRANSACTION"},{status:400});
  const rpc = process.env.RPC_URL?.trim();
  if (!rpc) return NextResponse.json({ok:false,error:"RPC_URL_MISSING"},{status:503});
  const client = createPublicClient({transport:http(rpc)});
  try {
    const receipt = await client.getTransactionReceipt({hash:hash as Hex});
    if (receipt.to?.toLowerCase() !== PONS_V2.factory.toLowerCase()) return NextResponse.json({ok:false,error:"NOT_PONS_LAUNCH"},{status:400});
    if (receipt.status !== "success") return NextResponse.json({ok:true,status:"reverted",hash});
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== PONS_V2.factory.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({abi:factoryLaunchAbi,data:log.data,topics:log.topics});
        if (decoded.eventName === "TokenLaunched") return NextResponse.json({ok:true,status:"confirmed",hash,token:decoded.args.token,creator:decoded.args.deployer,blockNumber:receipt.blockNumber.toString()});
      } catch { /* Other factory events are not launch confirmations. */ }
    }
    return NextResponse.json({ok:false,error:"LAUNCH_EVENT_MISSING"},{status:409});
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TransactionReceiptNotFoundError") return NextResponse.json({ok:true,status:"pending",hash});
    return NextResponse.json({ok:false,error:"LAUNCH_RECEIPT_UNAVAILABLE"},{status:503});
  }
}
