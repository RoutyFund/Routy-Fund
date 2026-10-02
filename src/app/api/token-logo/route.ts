import {NextResponse} from "next/server";
import {isAddress} from "viem";

const PONS_API="https://api.pons.family/api";
function logoFrom(value:unknown):string|null{
 if(typeof value==="string"&&(value.startsWith("https://")||value.startsWith("http://")||value.startsWith("data:image/")))return value;
 if(!value||typeof value!=="object")return null;
 const o=value as Record<string,unknown>;
 for(const key of ["logo","logoUrl","image","imageUrl","icon","iconUrl"]){const found=logoFrom(o[key]);if(found)return found}
 for(const key of ["metadata","token","launch","data","result"]){const found=logoFrom(o[key]);if(found)return found}
 return null;
}
export async function GET(req:Request){
 const token=new URL(req.url).searchParams.get("token")||"";
 if(!isAddress(token))return NextResponse.json({ok:false,error:"invalid_token"},{status:400});
 const paths=[`/tokens/${token}`,`/token/${token}`,`/launches/${token}`];
 for(const path of paths){try{const r=await fetch(PONS_API+path,{next:{revalidate:300}});if(!r.ok)continue;const data=await r.json();const logo=logoFrom(data);if(logo)return NextResponse.json({ok:true,logo,source:"pons"});}catch{}}
 return NextResponse.json({ok:true,logo:null,source:"pons"});
}
