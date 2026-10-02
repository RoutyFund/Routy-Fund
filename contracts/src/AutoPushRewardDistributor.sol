// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20PushReward {
    function balanceOf(address account) external view returns(uint256);
    function transfer(address to,uint256 amount) external returns(bool);
}

/// @notice Push-based distributor for routes that should send Stock Tokens directly
/// to holder wallets. A trusted publisher submits bounded batches. Holders do not claim.
contract AutoPushRewardDistributor {
    address public immutable rewardAsset;
    address public immutable publisher;
    uint256 public totalDistributed;
    uint256 public batchNonce;
    bool public paused=true;

    mapping(address=>uint256) public distributedTo;

    event Paused(bool paused);
    event BatchDistributed(uint256 indexed batchNonce,uint256 recipients,uint256 totalAmount);
    event RewardSent(address indexed account,uint256 amount,uint256 cumulativeAmount);

    modifier onlyPublisher(){require(msg.sender==publisher,"NOT_PUBLISHER");_;}

    constructor(address asset_,address publisher_){
        require(asset_!=address(0)&&publisher_!=address(0),"ZERO_ADDRESS");
        rewardAsset=asset_;
        publisher=publisher_;
    }

    function setPaused(bool next) external onlyPublisher {
        paused=next;
        emit Paused(next);
    }

    /// @notice Push a bounded batch directly to holders.
    /// cumulativeAmounts prevents duplicate payout across retried or later batches.
    function distributeBatch(address[] calldata accounts,uint256[] calldata cumulativeAmounts) external onlyPublisher {
        require(!paused,"PAUSED");
        uint256 n=accounts.length;
        require(n>0&&n==cumulativeAmounts.length&&n<=200,"BAD_BATCH");
        uint256 batchTotal;

        for(uint256 i;i<n;i++){
            address account=accounts[i];
            uint256 cumulative=cumulativeAmounts[i];
            require(account!=address(0),"ZERO_ACCOUNT");
            uint256 prev=distributedTo[account];
            require(cumulative>prev,"NOTHING_NEW");
            uint256 amount=cumulative-prev;
            distributedTo[account]=cumulative;
            batchTotal+=amount;
            require(IERC20PushReward(rewardAsset).transfer(account,amount),"TRANSFER_FAILED");
            emit RewardSent(account,amount,cumulative);
        }

        require(batchTotal>0,"ZERO_BATCH");
        totalDistributed+=batchTotal;
        unchecked{batchNonce++;}
        emit BatchDistributed(batchNonce,n,batchTotal);
    }

    function fundedBalance() external view returns(uint256){
        return IERC20PushReward(rewardAsset).balanceOf(address(this));
    }
}
