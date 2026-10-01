import {config} from "./config";
export type KeeperDecision={action:"wait"|"harvest"|"buy";reason:string};
export function decide(input:{claimable:bigint,available:bigint,halted:boolean,oracleFresh:boolean,quoteWithinDeviation:boolean}):KeeperDecision{
 if(input.claimable>=config.minHarvestWei&&input.claimable>0n)return{action:"harvest",reason:"claimable fees above threshold"};
 if(input.halted)return{action:"wait",reason:"target asset trading halted"};
 if(!input.oracleFresh)return{action:"wait",reason:"oracle stale"};
 if(!input.quoteWithinDeviation)return{action:"wait",reason:"DEX quote outside oracle deviation"};
 if(input.available>0n)return{action:"buy",reason:"earned balance available"};
 return{action:"wait",reason:"nothing actionable"};
}