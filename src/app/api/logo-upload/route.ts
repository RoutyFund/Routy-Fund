import {NextRequest,NextResponse} from "next/server";

export const runtime="nodejs";
const SUPABASE_URL="https://hcwtwtvovdzfuugnjqyz.supabase.co";
const BUCKET="token-logos";
const MAX_BYTES=2*1024*1024;
const TYPES:Record<string,string>={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"};

function authHeaders(contentType:string){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key)throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
 const h:Record<string,string>={apikey:key,"Content-Type":contentType};
 if(!key.startsWith("sb_"))h.Authorization="Bearer "+key;
 return h;
}
export async function POST(req:NextRequest){
 try{
  const form=await req.formData();
  const file=form.get("logo");
  if(!(file instanceof File))return NextResponse.json({ok:false,error:"LOGO_REQUIRED"},{status:400});
  const ext=TYPES[file.type];
  if(!ext)return NextResponse.json({ok:false,error:"UNSUPPORTED_IMAGE"},{status:400});
  if(file.size<=0||file.size>MAX_BYTES)return NextResponse.json({ok:false,error:"IMAGE_TOO_LARGE",maxBytes:MAX_BYTES},{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
  const objectPath="logos/"+hash+"."+ext;
  const upload=await fetch(SUPABASE_URL+"/storage/v1/object/"+BUCKET+"/"+objectPath,{method:"POST",headers:{...authHeaders(file.type),"x-upsert":"true"},body:bytes});
  if(!upload.ok)return NextResponse.json({ok:false,error:"UPLOAD_FAILED"},{status:503});
  const url=SUPABASE_URL+"/storage/v1/object/public/"+BUCKET+"/"+objectPath;
  if(new TextEncoder().encode(url).length>512)return NextResponse.json({ok:false,error:"URI_TOO_LONG"},{status:500});
  return NextResponse.json({ok:true,url});
 }catch(error){return NextResponse.json({ok:false,error:"UPLOAD_UNAVAILABLE",message:error instanceof Error?error.message:"Upload failed"},{status:503})}
}
