import type {MetadataRoute} from "next";

export default function manifest():MetadataRoute.Manifest{
 return{
  name:"Routy",
  short_name:"Routy",
  description:"A non-custodial protocol on Robinhood Chain that routes token creator fees into verified Stock Tokens and distributes rewards to holders.",
  start_url:"/",
  display:"standalone",
  background_color:"#ffffff",
  theme_color:"#1a6fd1",
  icons:[{src:"/icon-192.png",sizes:"192x192",type:"image/png"},{src:"/icon-512.png",sizes:"512x512",type:"image/png"}]
 };
}
