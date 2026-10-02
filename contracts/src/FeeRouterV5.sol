// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPonsFeeEscrow.sol";

interface IERC20FeeRouterV5 {
    function balanceOf(address account) external view returns(uint256);
    function transfer(address to,uint256 amount) external returns(bool);
}

interface IAssetVaultAccountingV5 {
    function recordTokenEarned(uint256 amount) external;
}

/// @notice Pre-deployable Pons creator-fee recipient. Pons may credit this
/// address before the Routy route exists. The factory binds it exactly once
/// after launch to the token's vault and quote asset.
contract FeeRouterV5 {
    uint256 public constant BPS=10_000;
    uint256 public constant VAULT_BPS=8_000;

    address public immutable factory;
    IPonsV2FeeEscrow public immutable feeEscrow;
    address public immutable treasury;

    address public launchedToken;
    address public quoteToken;
    address public assetVault;
    bool public bound;
    bool private locked;

    event Bound(address indexed token,address indexed quoteToken,address indexed vault);
    event Harvested(address indexed quoteToken,uint256 claimed,uint256 vaultAmount,uint256 treasuryAmount);

    modifier onlyFactory(){require(msg.sender==factory,"NOT_FACTORY");_;}
    modifier nonReentrant(){require(!locked,"REENTRANT");locked=true;_;locked=false;}

    constructor(address factory_,address escrow_,address treasury_){
        require(factory_!=address(0)&&escrow_!=address(0)&&treasury_!=address(0),"ZERO_ADDRESS");
        factory=factory_;
        feeEscrow=IPonsV2FeeEscrow(escrow_);
        treasury=treasury_;
    }

    function bind(address token_,address quote_,address vault_) external onlyFactory {
        require(!bound&&token_!=address(0)&&vault_!=address(0),"INVALID_BIND");
        launchedToken=token_;
        quoteToken=quote_;
        assetVault=vault_;
        bound=true;
        emit Bound(token_,quote_,vault_);
    }

    receive() external payable {}

    function harvest() external nonReentrant returns(uint256 claimed){
        require(bound,"NOT_BOUND");
        if(quoteToken==address(0)){
            uint256 beforeBal=address(this).balance;
            feeEscrow.claim();
            claimed=address(this).balance-beforeBal;
            require(claimed>0,"NO_NEW_FEES");
            uint256 vaultAmount=claimed*VAULT_BPS/BPS;
            uint256 treasuryAmount=claimed-vaultAmount;
            (bool okV,)=assetVault.call{value:vaultAmount}("");
            require(okV,"VAULT_TRANSFER_FAILED");
            (bool okT,)=treasury.call{value:treasuryAmount}("");
            require(okT,"TREASURY_TRANSFER_FAILED");
            emit Harvested(address(0),claimed,vaultAmount,treasuryAmount);
        }else{
            IERC20FeeRouterV5 token=IERC20FeeRouterV5(quoteToken);
            uint256 beforeBal=token.balanceOf(address(this));
            feeEscrow.claimToken(quoteToken);
            claimed=token.balanceOf(address(this))-beforeBal;
            require(claimed>0,"NO_NEW_FEES");
            uint256 vaultAmount=claimed*VAULT_BPS/BPS;
            uint256 treasuryAmount=claimed-vaultAmount;
            require(token.transfer(assetVault,vaultAmount),"VAULT_TRANSFER_FAILED");
            IAssetVaultAccountingV5(assetVault).recordTokenEarned(vaultAmount);
            require(token.transfer(treasury,treasuryAmount),"TREASURY_TRANSFER_FAILED");
            emit Harvested(quoteToken,claimed,vaultAmount,treasuryAmount);
        }
    }
}
