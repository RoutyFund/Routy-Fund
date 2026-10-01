// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IERC20Reward{function transfer(address,uint256)external returns(bool);}
contract RewardDistributor{
 address public immutable rewardAsset;address public immutable rootPublisher;bytes32 public merkleRoot;uint256 public rootVersion;mapping(address=>uint256)public claimed;
 event RootPublished(uint256 indexed version,bytes32 indexed root);event Claimed(address indexed account,uint256 amount,uint256 cumulativeAmount);
 constructor(address a,address p){require(a!=address(0)&&p!=address(0),"ZERO_ADDRESS");rewardAsset=a;rootPublisher=p;}
 function publishRoot(bytes32 root)external{require(msg.sender==rootPublisher,"NOT_PUBLISHER");require(root!=bytes32(0)&&root!=merkleRoot,"BAD_ROOT");merkleRoot=root;unchecked{rootVersion++;}emit RootPublished(rootVersion,root);}
 function claim(uint256 cumulativeAmount,bytes32[] calldata proof)external{bytes32 h=keccak256(bytes.concat(keccak256(abi.encode(msg.sender,cumulativeAmount))));for(uint256 i;i<proof.length;i++){bytes32 p=proof[i];h=h<p?keccak256(abi.encodePacked(h,p)):keccak256(abi.encodePacked(p,h));}require(h==merkleRoot,"BAD_PROOF");uint256 prev=claimed[msg.sender];require(cumulativeAmount>prev,"NOTHING_TO_CLAIM");uint256 amount=cumulativeAmount-prev;claimed[msg.sender]=cumulativeAmount;require(IERC20Reward(rewardAsset).transfer(msg.sender,amount),"TRANSFER_FAILED");emit Claimed(msg.sender,amount,cumulativeAmount);}
}