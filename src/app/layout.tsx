import "./globals.css";import "./repair.css";import "./brand.css";import type {Metadata,Viewport} from "next";import {Inter,JetBrains_Mono} from "next/font/google";import TerminalFooter from "@/components/TerminalFooter";

const sans=Inter({subsets:["latin"],variable:"--font-sans",display:"swap"});
const mono=JetBrains_Mono({subsets:["latin"],variable:"--font-mono",display:"swap"});

const TITLE="Routy — Creator Fee Routing on Robinhood Chain";
const DESCRIPTION="Routy is a non-custodial protocol on Robinhood Chain that routes token creator fees into verified Stock Tokens and distributes rewards to holders.";

export const metadata:Metadata={
 metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||"https://routy-fund.vercel.app"),
 title:{default:TITLE,template:"%s · Routy"},
 description:DESCRIPTION,
 applicationName:"Routy",
 keywords:["Routy","Robinhood Chain","Stock Tokens","creator fees","token launch","holder rewards","Pons","DeFi"],
 icons:{icon:[{url:"/favicon.ico",sizes:"any"},{url:"/icon.png",type:"image/png",sizes:"512x512"}],apple:[{url:"/apple-icon.png",sizes:"180x180"}]},
 openGraph:{title:TITLE,description:DESCRIPTION,siteName:"Routy",type:"website"},
 twitter:{card:"summary_large_image",title:TITLE,description:DESCRIPTION}
};
export const viewport:Viewport={themeColor:"#1a6fd1",width:"device-width",initialScale:1};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={sans.variable+" "+mono.variable}><body>{children}<TerminalFooter/></body></html>}
