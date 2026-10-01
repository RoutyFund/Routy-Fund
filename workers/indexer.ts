import {protocolEvents,ProtocolEvent} from "./events";
export type IndexedEvent={chainId:4663;blockNumber:bigint;txHash:`0x${string}`;logIndex:number;name:ProtocolEvent;address:`0x${string}`;args:Record<string,unknown>};
export function eventKey(e:IndexedEvent){return `${e.chainId}:${e.txHash}:${e.logIndex}`}
export function acceptsEvent(name:string):name is ProtocolEvent{return (protocolEvents as readonly string[]).includes(name)}
export function sortEvents(events:IndexedEvent[]){return [...events].sort((a,b)=>a.blockNumber===b.blockNumber?a.logIndex-b.logIndex:a.blockNumber<b.blockNumber?-1:1)}