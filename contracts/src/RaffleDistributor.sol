// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract RaffleDistributor{
 struct Round{bytes32 root;bytes32 randomness;address winner;uint64 challengeEnds;bool finalized;}
 address public immutable snapshotPublisher;address public immutable randomnessProvider;mapping(uint256=>Round)public rounds;
 event SnapshotPublished(uint256 indexed id,bytes32 root,uint64 challengeEnds);event RandomnessRecorded(uint256 indexed id,bytes32 randomness);event WinnerFinalized(uint256 indexed id,address winner);
 constructor(address p,address r){require(p!=address(0)&&r!=address(0),"ZERO_ADDRESS");snapshotPublisher=p;randomnessProvider=r;}
 function publish(uint256 id,bytes32 root,uint64 ends)external{require(msg.sender==snapshotPublisher,"NOT_PUBLISHER");require(root!=0&&rounds[id].root==0&&ends>block.timestamp,"BAD_ROUND");rounds[id].root=root;rounds[id].challengeEnds=ends;emit SnapshotPublished(id,root,ends);}
 function recordRandomness(uint256 id,bytes32 random)external{require(msg.sender==randomnessProvider,"NOT_RANDOMNESS_PROVIDER");Round storage r=rounds[id];require(r.root!=0&&block.timestamp>=r.challengeEnds&&r.randomness==0&&random!=0,"NOT_READY");r.randomness=random;emit RandomnessRecorded(id,random);}
 function finalize(uint256 id,address winner)external{Round storage r=rounds[id];require(r.randomness!=0&&!r.finalized&&winner!=address(0),"NOT_READY");r.winner=winner;r.finalized=true;emit WinnerFinalized(id,winner);}
}