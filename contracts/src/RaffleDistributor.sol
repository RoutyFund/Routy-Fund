// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Verifies a winner against a committed snapshot after independent randomness.
/// Snapshot leaves commit an account plus its cumulative ticket upper-bound.
/// The selected ticket is randomness modulo totalTickets; the submitted winner must
/// prove an interval (previousUpperBound, cumulativeUpperBound] containing that ticket.
contract RaffleDistributor{
 struct Round{bytes32 root;bytes32 randomness;address winner;uint64 challengeEnds;uint256 totalTickets;bool finalized;}
 address public immutable snapshotPublisher;address public immutable randomnessProvider;mapping(uint256=>Round)public rounds;
 event SnapshotPublished(uint256 indexed id,bytes32 root,uint64 challengeEnds,uint256 totalTickets);event RandomnessRecorded(uint256 indexed id,bytes32 randomness);event WinnerFinalized(uint256 indexed id,address winner,uint256 winningTicket);
 constructor(address p,address r){require(p!=address(0)&&r!=address(0),"ZERO_ADDRESS");snapshotPublisher=p;randomnessProvider=r;}
 function publish(uint256 id,bytes32 root,uint64 ends,uint256 totalTickets)external{require(msg.sender==snapshotPublisher,"NOT_PUBLISHER");require(root!=0&&rounds[id].root==0&&ends>block.timestamp&&totalTickets>0,"BAD_ROUND");rounds[id].root=root;rounds[id].challengeEnds=ends;rounds[id].totalTickets=totalTickets;emit SnapshotPublished(id,root,ends,totalTickets);}
 function recordRandomness(uint256 id,bytes32 random)external{require(msg.sender==randomnessProvider,"NOT_RANDOMNESS_PROVIDER");Round storage r=rounds[id];require(r.root!=0&&block.timestamp>=r.challengeEnds&&r.randomness==0&&random!=0,"NOT_READY");r.randomness=random;emit RandomnessRecorded(id,random);}
 function winningTicket(uint256 id)public view returns(uint256){Round storage r=rounds[id];require(r.randomness!=0&&r.totalTickets>0,"NOT_READY");return uint256(r.randomness)%r.totalTickets+1;}
 function finalize(uint256 id,address winner,uint256 previousUpperBound,uint256 cumulativeUpperBound,bytes32[] calldata proof)external{
  Round storage r=rounds[id];require(r.randomness!=0&&!r.finalized&&winner!=address(0),"NOT_READY");require(previousUpperBound<cumulativeUpperBound&&cumulativeUpperBound<=r.totalTickets,"BAD_RANGE");
  bytes32 h=keccak256(bytes.concat(keccak256(abi.encode(winner,previousUpperBound,cumulativeUpperBound))));
  for(uint256 i;i<proof.length;i++){bytes32 p=proof[i];h=h<p?keccak256(abi.encodePacked(h,p)):keccak256(abi.encodePacked(p,h));}
  require(h==r.root,"BAD_PROOF");uint256 ticket=winningTicket(id);require(ticket>previousUpperBound&&ticket<=cumulativeUpperBound,"NOT_WINNER");
  r.winner=winner;r.finalized=true;emit WinnerFinalized(id,winner,ticket);
 }
}