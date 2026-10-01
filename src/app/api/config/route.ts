import {NextResponse} from "next/server";
import {PONS_V2} from "@/lib/pons";
import {protocolReadiness} from "@/lib/env";
import {ROUTY_DEPLOYMENT,ROUTY_RELEASE_STATE} from "@/lib/deployment";

export function GET(){
 return NextResponse.json({
  chainId:4663,
  pons:{factory:PONS_V2.factory,feeEscrow:PONS_V2.feeEscrow,launchAndBuy:PONS_V2.launchAndBuy,poolManager:PONS_V2.poolManager},
  routy:{...protocolReadiness(),deployment:ROUTY_DEPLOYMENT,...ROUTY_RELEASE_STATE,swapExecutionEnabled:process.env.ROUTY_SWAP_EXECUTION_ENABLED==="true"}
 })
}
