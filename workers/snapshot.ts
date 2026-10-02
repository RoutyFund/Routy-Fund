export type SnapshotBalance={address:`0x${string}`;balance:bigint};
const ZERO="0x0000000000000000000000000000000000000000";

export function eligible(balances:SnapshotBalance[],excluded:readonly string[]=[]){
 const blocked=new Set([ZERO,...excluded].map(x=>x.toLowerCase()));
 const merged=new Map<string,SnapshotBalance>();
 for(const row of balances){
  const key=row.address.toLowerCase();
  if(row.balance<=0n||blocked.has(key))continue;
  const prev=merged.get(key);
  merged.set(key,{address:row.address,balance:(prev?.balance??0n)+row.balance});
 }
 return [...merged.values()].sort((a,b)=>a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
}
export function totalBalance(balances:SnapshotBalance[]){return balances.reduce((n,x)=>n+x.balance,0n)}
export function weightedIndex(balances:SnapshotBalance[],random:bigint,excluded:readonly string[]=[]){const xs=eligible(balances,excluded);const total=totalBalance(xs);if(total===0n)throw new Error("EMPTY_SNAPSHOT");let cursor=random%total;for(let i=0;i<xs.length;i++){if(cursor<xs[i].balance)return i;cursor-=xs[i].balance}return xs.length-1}
export function equalIndex(balances:SnapshotBalance[],random:bigint,excluded:readonly string[]=[]){const xs=eligible(balances,excluded);if(!xs.length)throw new Error("EMPTY_SNAPSHOT");return Number(random%BigInt(xs.length))}
