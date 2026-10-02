import {encodeAbiParameters,isAddress,keccak256,toBytes,type Address,type Hex} from "viem";

export type V5LaunchIntent={creator:string;targetAsset:string;policy:number;nonce:string};
const domain=keccak256(toBytes("ROUTY_V5_LAUNCH_INTENT_V1"));
const parameters=[{type:"bytes32"},{type:"uint256"},{type:"address"},{type:"address"},{type:"uint8"},{type:"bytes32"}] as const;

// The signed Pons launch commits to this salt through its fee-router address.
// Binding the route choices here authorizes setup without another wallet signature.
export function v5LaunchIntentSalt(intent:V5LaunchIntent):Hex{
 const {creator,targetAsset,policy,nonce}=intent;
 if(!isAddress(creator,{strict:false})||/^0x0{40}$/i.test(creator)
  ||!isAddress(targetAsset,{strict:false})||/^0x0{40}$/i.test(targetAsset)
  ||!Number.isInteger(policy)||policy<0||policy>2
  ||!/^0x[0-9a-fA-F]{64}$/.test(nonce))throw new Error("INVALID_LAUNCH_INTENT");
 return keccak256(encodeAbiParameters(parameters,[domain,4663n,creator as Address,targetAsset as Address,policy,nonce as Hex]));
}

export function matchesV5LaunchIntent(salt:string,intent:V5LaunchIntent):boolean{
 if(!/^0x[0-9a-fA-F]{64}$/.test(salt))return false;
 try{return v5LaunchIntentSalt(intent).toLowerCase()===salt.toLowerCase()}
 catch{return false}
}
