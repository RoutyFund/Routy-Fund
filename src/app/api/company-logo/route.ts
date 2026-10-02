import {NextResponse} from "next/server";
import {canonicalAssets,deployment4663} from "@/lib/robinhood";
import {EXECUTABLE_ROUTES} from "@/lib/route-catalog";

const HEADERS={
 "Cache-Control":"public, max-age=86400, s-maxage=86400",
 "X-Content-Type-Options":"nosniff"
};

async function image(url:string,source:string){
 const upstream=await fetch(url,{next:{revalidate:86400}});
 if(!upstream.ok)return null;
 const type=upstream.headers.get("content-type")||"";
 if(!type.startsWith("image/"))return null;
 return new NextResponse(await upstream.arrayBuffer(),{status:200,headers:{"Content-Type":type,"X-Logo-Source":source,...HEADERS}});
}

// Preferred source: the live Robinhood registry. The logo is matched by the Stock Token's Robinhood Chain contract address.
async function liveLogo(symbol:string){
 try{
  const route=EXECUTABLE_ROUTES.find(r=>r.symbol===symbol);
  if(!route)return null;
  const asset=(await canonicalAssets()).find(a=>deployment4663(a)?.toLowerCase()===route.target.toLowerCase());
  const url=asset?.logoUrl;
  if(!url)return null;
  const parsed=new URL(url);
  if(parsed.protocol!=="https:"||!(parsed.hostname==="robinhood.com"||parsed.hostname.endsWith(".robinhood.com")))return null;
  return await image(parsed.toString(),"robinhood");
 }catch{return null}
}

export async function GET(req:Request){
 const symbol=(new URL(req.url).searchParams.get("symbol")||"").trim().toUpperCase();
 if(!/^[A-Z0-9.\-]{1,16}$/.test(symbol))return new NextResponse(null,{status:400});
 const live=await liveLogo(symbol);
 if(live)return live;
 // Fallback: public company logo by ticker.
 try{
  const fallback=await image("https://financialmodelingprep.com/image-stock/"+encodeURIComponent(symbol)+".png","fallback");
  return fallback??new NextResponse(null,{status:404});
 }catch{return new NextResponse(null,{status:502})}
}
