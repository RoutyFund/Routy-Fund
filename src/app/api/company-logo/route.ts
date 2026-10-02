import {NextResponse} from "next/server";

export async function GET(req:Request){
 const symbol=(new URL(req.url).searchParams.get("symbol")||"").trim().toUpperCase();
 if(!/^[A-Z0-9.\-]{1,16}$/.test(symbol))return new NextResponse(null,{status:400});
 try{
  const upstream=await fetch("https://financialmodelingprep.com/image-stock/"+encodeURIComponent(symbol)+".png",{next:{revalidate:86400}});
  if(!upstream.ok)return new NextResponse(null,{status:404});
  const type=upstream.headers.get("content-type")||"";
  if(!type.startsWith("image/"))return new NextResponse(null,{status:404});
  const body=await upstream.arrayBuffer();
  return new NextResponse(body,{status:200,headers:{
   "Content-Type":type,
   "Cache-Control":"public, max-age=86400, s-maxage=86400",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch{return new NextResponse(null,{status:502})}
}
