// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20RewardFunding {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to,uint256 amount) external returns (bool);
}

/// @notice Route-scoped reward vault. Stock Tokens can be funded here and claimed
/// against cumulative Merkle allocations published by the configured publisher.
contract AutomatedRewardDistributor {
    address public immutable rewardAsset;
    address public immutable rootPublisher;
    bytes32 public merkleRoot;
    uint256 public rootVersion;
    uint256 public totalClaimed;
    mapping(address=>uint256) public claimed;

    event Funded(address indexed from,uint256 amount,uint256 balance);
    event RootPublished(uint256 indexed version,bytes32 indexed root,uint256 fundedBalance);
    event Claimed(address indexed account,uint256 amount,uint256 cumulativeAmount);

    constructor(address asset,address publisher){
        require(asset!=address(0)&&publisher!=address(0),"ZERO_ADDRESS");
        rewardAsset=asset;
        rootPublisher=publisher;
    }

    function publishRoot(bytes32 root) external {
        require(msg.sender==rootPublisher,"NOT_PUBLISHER");
        require(root!=bytes32(0)&&root!=merkleRoot,"BAD_ROOT");
        merkleRoot=root;
        unchecked{rootVersion++;}
        emit RootPublished(rootVersion,root,IERC20RewardFunding(rewardAsset).balanceOf(address(this)));
    }

    function claim(uint256 cumulativeAmount,bytes32[] calldata proof) external {
        bytes32 h=keccak256(bytes.concat(keccak256(abi.encode(msg.sender,cumulativeAmount))));
        for(uint256 i;i<proof.length;i++){
            bytes32 p=proof[i];
            h=h<p?keccak256(abi.encodePacked(h,p)):keccak256(abi.encodePacked(p,h));
        }
        require(h==merkleRoot,"BAD_PROOF");
        uint256 prev=claimed[msg.sender];
        require(cumulativeAmount>prev,"NOTHING_TO_CLAIM");
        uint256 amount=cumulativeAmount-prev;
        claimed[msg.sender]=cumulativeAmount;
        totalClaimed+=amount;
        require(IERC20RewardFunding(rewardAsset).transfer(msg.sender,amount),"TRANSFER_FAILED");
        emit Claimed(msg.sender,amount,cumulativeAmount);
    }

    function fundedBalance() external view returns(uint256){
        return IERC20RewardFunding(rewardAsset).balanceOf(address(this));
    }
}
