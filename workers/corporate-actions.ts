export type MultiplierState={asset:string;previous:string;current:string};
export function multiplierChanged(x:MultiplierState){return x.previous!==x.current}
export function displayUnits(raw:bigint,multiplier:number,decimals=18){if(!Number.isFinite(multiplier)||multiplier<=0)throw new Error("BAD_MULTIPLIER");return Number(raw)/10**decimals*multiplier}