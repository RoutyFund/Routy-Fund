// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Reward { function transfer(address to, uint256 amount) external returns (bool); }

contract RewardDistributor {
    address public immutable rewardAsset;
    address public immutable rootPublisher;
    bytes32 public merkleRoot;
    mapping(address=>uint256) public claimed;

    event RootPublished(bytes32 indexed root);
    event Claimed(address indexed account, uint256 amount);

    constructor(address asset_, address publisher_) {
        require(asset_!=address(0)&&publisher_!=address(0),"ZERO_ADDRESS");
        rewardAsset=asset_; rootPublisher=publisher_;
    }

    function publishRoot(bytes32 root) external {
        require(msg.sender==rootPublisher,"NOT_PUBLISHER");
        require(merkleRoot==bytes32(0),"ROOT_LOCKED");
        merkleRoot=root; emit RootPublished(root);
    }

    function claim(uint256 cumulativeAmount, bytes32[] calldata proof) external {
        bytes32 leaf=keccak256(bytes.concat(keccak256(abi.encode(msg.sender,cumulativeAmount))));
        bytes32 h=leaf;
        for(uint256 i;i<proof.length;i++){bytes32 p=proof[i]; h=h<p?keccak256(abi.encodePacked(h,p)):keccak256(abi.encodePacked(p,h));}
        require(h==merkleRoot,"BAD_PROOF");
        uint256 amount=cumulativeAmount-claimed[msg.sender];
        require(amount>0,"NOTHING_TO_CLAIM");
        claimed[msg.sender]=cumulativeAmount;
        require(IERC20Reward(rewardAsset).transfer(msg.sender,amount),"TRANSFER_FAILED");
        emit Claimed(msg.sender,amount);
    }
}
