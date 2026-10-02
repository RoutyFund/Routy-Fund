import type {Address} from "viem";

export type RouteCandidate={symbol:string;name:string;target:Address;targetFeed:Address};

export const ROUTE_CANDIDATES:RouteCandidate[]=[
 {symbol:"AMD",name:"AMD",target:"0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",targetFeed:"0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72"},
 {symbol:"MSFT",name:"Microsoft",target:"0xe93237C50D904957Cf27E7B1133b510C669c2e74",targetFeed:"0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E"},
 {symbol:"AMZN",name:"Amazon",target:"0x12f190a9F9d7D37a250758b26824B97CE941bF54",targetFeed:"0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C"},
 {symbol:"GOOGL",name:"Alphabet Class A",target:"0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",targetFeed:"0xF6f373a037c30F0e5010d854385cA89185AE638b"},
 {symbol:"META",name:"Meta Platforms",target:"0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",targetFeed:"0x7C38C00C30BEe9378381E7B6135d7283356D71b1"},
 {symbol:"COIN",name:"Coinbase",target:"0x6330D8C3178a418788dF01a47479c0ce7CCF450b",targetFeed:"0xA3a468A452940B7D6b69991207B508c609a98Ef2"},
 {symbol:"INTC",name:"Intel",target:"0xc72b96e0E48ecd4DC75E1e45396e26300BC39681",targetFeed:"0x3f390C5C24628Ac7C489515402235FeAD71D1913"},
 {symbol:"GME",name:"GameStop",target:"0x1b0E319c6A659F002271B69dB8A7df2F911c153E",targetFeed:"0x27C71df6A64fB476468EdF256CF72c038baB5B67"},
 {symbol:"BABA",name:"Alibaba",target:"0xad25Ac6C84D497db898fa1E8387bf6Af3532a1c4",targetFeed:"0x62Cc8F9b5f56a33c9C8A60c8B92779f523c4E984"},
 {symbol:"CRCL",name:"Circle Internet Group",target:"0xdF0992E440dD0be65BD8439b609d6D4366bf1CB5",targetFeed:"0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a"},
 {symbol:"IONQ",name:"IonQ",target:"0x558378E000D634A36593E338eBacdd6207640EfE",targetFeed:"0x22EfeC4919baf55F360E0EDee4AbEB26DE4971eb"},
];
