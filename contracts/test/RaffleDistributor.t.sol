// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/RaffleDistributor.sol";
contract RaffleDistributorTest {
 function leaf(address a,uint256 lo,uint256 hi)internal pure returns(bytes32){return keccak256(bytes.concat(keccak256(abi.encode(a,lo,hi))));}
 function testWinnerMustMatchCommittedRange() public {
  RaffleDistributor r=new RaffleDistributor(address(this),address(this));address alice=address(0xA11CE);address bob=address(0xB0B);
  bytes32 a=leaf(alice,0,5);bytes32 b=leaf(bob,5,10);bytes32 root=a<b?keccak256(abi.encodePacked(a,b)):keccak256(abi.encodePacked(b,a));
  r.publish(1,root,uint64(block.timestamp+1),10);vmWarp(block.timestamp+1);r.recordRandomness(1,bytes32(uint256(2)));
  bytes32[] memory proof=new bytes32[](1);proof[0]=b;r.finalize(1,alice,0,5,proof);(,,,address winner,,,bool finalized)=r.rounds(1);require(winner==alice&&finalized,"NOT_FINALIZED");
 }
 function testArbitraryWinnerRejected() public {
  RaffleDistributor r=new RaffleDistributor(address(this),address(this));address alice=address(0xA11CE);address bob=address(0xB0B);
  bytes32 a=leaf(alice,0,5);bytes32 b=leaf(bob,5,10);bytes32 root=a<b?keccak256(abi.encodePacked(a,b)):keccak256(abi.encodePacked(b,a));
  r.publish(2,root,uint64(block.timestamp+1),10);vmWarp(block.timestamp+1);r.recordRandomness(2,bytes32(uint256(2)));
  bytes32[] memory proof=new bytes32[](1);proof[0]=a;try r.finalize(2,bob,5,10,proof){revert("SHOULD_REVERT");}catch{}
 }
 function vmWarp(uint256 t)internal{address vm=address(uint160(uint256(keccak256("hevm cheat code"))));(bool ok,)=vm.call(abi.encodeWithSignature("warp(uint256)",t));require(ok,"WARP_FAILED");}
}