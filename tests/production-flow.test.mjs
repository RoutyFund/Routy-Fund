import assert from 'node:assert/strict';
import test from 'node:test';
import {firstCodeBlock} from '../src/lib/contract-history.ts';
import {applyHolderTransfers} from '../src/lib/holder-balances.ts';
import {readPendingLaunch,launchMetadataError} from '../src/lib/pending-launch.ts';
import {readRewardPlan,unpaidRewardRows} from '../src/lib/reward-plan.ts';
import {fetchJson} from '../src/lib/fetch-json.ts';
import {publicErrorMessage} from '../src/lib/public-error.ts';

const zero='0x'+'0'.repeat(40);
const a='0x'+'1'.repeat(40), b='0x'+'2'.repeat(40), c='0x'+'3'.repeat(40);
const hash='0x'+'a'.repeat(64);
test('creation block search covers complete history beyond the former recent window', async()=>{
 const calls=[];
 const block=await firstCodeBlock(80_000_000n,async value=>{calls.push(value);return value>=12_345_678n});
 assert.equal(block,12_345_678n);assert.ok(calls.length<=28);
 assert.equal(await firstCodeBlock(0n,async()=>true),0n);
 assert.equal(await firstCodeBlock(20n,async value=>value===20n),20n);
});
test('historical RPC failure never becomes a guessed creation block', async()=>{
 await assert.rejects(firstCodeBlock(30n,async value=>{if(value===30n)return true;throw new Error('archive unavailable')}),/archive unavailable/);
 await assert.rejects(firstCodeBlock(30n,async()=>false),/NOT_DEPLOYED/);
});
test('complete transfer replay handles mint, burn, exclusions and self transfers',()=>{
 const balances=new Map();
 applyHolderTransfers(balances,[{from:zero,to:a,value:100n},{from:a,to:b,value:40n},{from:b,to:b,value:15n},{from:b,to:zero,value:10n},{from:b,to:c,value:5n}]);
 assert.equal(balances.get(a).balance,60n);assert.equal(balances.get(b).balance,25n);assert.equal(balances.get(c).balance,5n);
 assert.equal([...balances.values()].reduce((sum,row)=>sum+row.balance,0n),90n);
});
test('missing mint or earlier balance stops reward allocation instead of inventing funds',()=>{
 assert.throws(()=>applyHolderTransfers(new Map(),[{from:a,to:b,value:1n}]),/INCOMPLETE_TRANSFER_HISTORY/);
 const balances=new Map([[a,{address:a,balance:2n}]]);
 assert.throws(()=>applyHolderTransfers(balances,[{from:a,to:b,value:3n}]),/INCOMPLETE_TRANSFER_HISTORY/);
});
const progress={version:1,chainId:4663,creator:a,targetAsset:b,feeRouter:c,policy:2,intentNonce:hash,setupNonce:hash,launchTx:hash};
test('submitted launch can be restored with its original hash and setup intent',()=>{
 assert.deepEqual(readPendingLaunch(JSON.stringify(progress)),progress);
 assert.deepEqual(readPendingLaunch(JSON.stringify({...progress,token:a,queued:true})),{...progress,token:a,queued:true});
 for(const bad of [{...progress,chainId:1},{...progress,policy:3},{...progress,launchTx:'0x123'},{...progress,creator:zero},{...progress,queued:'true'}])assert.equal(readPendingLaunch(JSON.stringify(bad)),null);
 assert.equal(readPendingLaunch('{broken'),null);assert.equal(readPendingLaunch(null),null);
});
test('launch validation uses UTF-8 byte limits and does not silently clamp creator tax',()=>{
 const input={logo:'https://logo',description:'ok',socials:[],tax:'10',maxTax:1000};
 assert.equal(launchMetadataError(input),'');
 assert.match(launchMetadataError({...input,logo:'é'.repeat(257)}),/512 bytes/);
 assert.match(launchMetadataError({...input,description:'🙂'.repeat(513)}),/2048 bytes/);
 assert.match(launchMetadataError({...input,socials:['é'.repeat(129)]}),/256 bytes/);
 for(const tax of ['-1','0.5','1001','abc',''])assert.match(launchMetadataError({...input,tax}),/whole number/);
});
const expected={token:a,distributor:b,controller:c};
const plan={version:1,...expected,snapshotBlock:'100',fundedBalance:'100',allocations:[{address:a,cumulativeAmount:'70'},{address:b,cumulativeAmount:'50'}]};
test('reward retry keeps original cumulative targets after a partial batch',()=>{
 const saved=readRewardPlan(JSON.parse(JSON.stringify(plan)),expected);
 const remaining=unpaidRewardRows(saved,new Map([[a,70n],[b,20n]]));
 assert.deepEqual(remaining,[{address:b,cumulativeAmount:'50'}]);
 assert.equal(BigInt(remaining[0].cumulativeAmount)-20n,30n);
 assert.deepEqual(unpaidRewardRows(saved,new Map([[a,70n],[b,50n]])),[]);
 assert.deepEqual(unpaidRewardRows(saved,new Map([[a,80n],[b,50n]])),[]);
});
test('reward plans reject another route, duplicate recipient or invalid cumulative amounts',()=>{
 assert.equal(readRewardPlan(null,expected),null);
 assert.throws(()=>readRewardPlan({...plan,controller:a},expected),/ROUTE_MISMATCH/);
 assert.throws(()=>readRewardPlan({...plan,allocations:[plan.allocations[0],plan.allocations[0]]},expected),/INVALID_REWARD_PLAN_ROW/);
 assert.throws(()=>readRewardPlan({...plan,allocations:[{address:a,cumulativeAmount:'-1'}]},expected),/INVALID_REWARD_PLAN_ROW/);
});
test('a resumed 450-holder distribution pays the remaining 250 holders once',()=>{
 const allocations=Array.from({length:450},(_,i)=>({address:'0x'+(i+1).toString(16).padStart(40,'0'),cumulativeAmount:'10'}));
 const large={...plan,allocations,fundedBalance:'4500'};
 const paid=new Map(allocations.slice(0,200).map(row=>[row.address,10n]));
 const restored=readRewardPlan(JSON.parse(JSON.stringify(large)),expected);
 const remaining=unpaidRewardRows(restored,paid);
 assert.equal(remaining.length,250);
 assert.equal(remaining.reduce((sum,row)=>sum+BigInt(row.cumulativeAmount),0n),2500n);
 for(const row of remaining)paid.set(row.address,BigInt(row.cumulativeAmount));
 assert.equal(unpaidRewardRows(restored,paid).length,0);
 assert.equal([...paid.values()].reduce((sum,value)=>sum+value,0n),4500n);
});
test('saved reward cursor resumes beyond earlier batches and rejects invalid offsets',()=>{
 const allocations=Array.from({length:10000},(_,i)=>({address:'0x'+(i+1).toString(16).padStart(40,'0'),cumulativeAmount:'10'}));
 const saved=readRewardPlan({...plan,allocations,nextIndex:9000},expected);
 assert.equal(saved.allocations.slice(saved.nextIndex).length,1000);
 assert.equal(saved.allocations[saved.nextIndex].address,allocations[9000].address);
 for(const nextIndex of [-1,10001,0.5,'9000'])assert.throws(()=>readRewardPlan({...plan,allocations,nextIndex},expected),/CURSOR/);
});
test('public RPC errors do not disclose provider URL or secret API keys',()=>{
 assert.equal(publicErrorMessage(new Error('RPC_URL_MISSING')),'RPC_URL_MISSING');
 const error=new Error('HTTP request failed. URL: https://rpc.example/v2/private-api-key');
 assert.equal(publicErrorMessage(error),'ONCHAIN_DATA_UNAVAILABLE');
 assert.equal(publicErrorMessage({message:'private-api-key'}),'ONCHAIN_DATA_UNAVAILABLE');
});
test('failed API responses are errors rather than successful empty data',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,error:'RPC_UNAVAILABLE',launches:[]}),{status:503});
  await assert.rejects(fetchJson('/api/routy-launches'),/RPC_UNAVAILABLE/);
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,error:'BAD_DATA'}),{status:200});
  await assert.rejects(fetchJson('/api/assets'),/BAD_DATA/);
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,launches:[]}),{status:200});
  assert.deepEqual(await fetchJson('/api/routy-launches'),{ok:true,launches:[]});
 }finally{globalThis.fetch=original}
});
