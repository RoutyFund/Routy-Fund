import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(){
 return NextResponse.json({
  ok:true,
  enabled:process.env.ROUTY_AUTO_SETUP_ENABLED==="true",
  mode:process.env.ROUTY_AUTO_SETUP_ENABLED==="true"?"automatic":"manual-fallback"
 });
}
