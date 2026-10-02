import {NextResponse} from "next/server";
import {isAddress} from "viem";

export async function GET(req:Request){
 const address=new URL(req.url).searchParams.get("address")||"";
 if(!isAddress(address))return new NextResponse(null,{status:400});
 try{
  const upstream=await fetch("https://cdn.robinhood.com/ncw_assets/logos/"+address.toLowerCase()+".png",{next:{revalidate:86400}});
  if(!upstream.ok)return new NextResponse(null,{status:404});
  const body=await upstream.arrayBuffer();
  return new NextResponse(body,{status:200,headers:{
   "Content-Type":upstream.headers.get("content-type")||"image/png",
   "Cache-Control":"public, max-age=86400, s-maxage=86400",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch{return new NextResponse(null,{status:502})}
}
