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

    error NotFactory();
    error Reentrant();
    error ZeroAddress();
    error InvalidBind();
    error NotBound();
    error NoNewFees();
    error VaultTransferFailed();
    error TreasuryTransferFailed();

    modifier onlyFactory(){if(msg.sender!=factory) revert NotFactory();_;}
    modifier nonReentrant(){if(locked) revert Reentrant();locked=true;_;locked=false;}

    constructor(address factory_,address escrow_,address treasury_){
        if(factory_==address(0)||escrow_==address(0)||treasury_==address(0)) revert ZeroAddress();
        factory=factory_;
        feeEscrow=IPonsV2FeeEscrow(escrow_);
        treasury=treasury_;
    }

    function bind(address token_,address quote_,address vault_) external onlyFactory {
        if(bound||token_==address(0)||vault_==address(0)) revert InvalidBind();
        launchedToken=token_;
        quoteToken=quote_;
        assetVault=vault_;
        bound=true;
        emit Bound(token_,quote_,vault_);
    }

    receive() external payable {}

    function harvest() external nonReentrant returns(uint256 claimed){
        if(!bound) revert NotBound();
        address quote=quoteToken;
        if(quote==address(0)){
            uint256 beforeBal=address(this).balance;
            feeEscrow.claim();
            claimed=address(this).balance-beforeBal;
        }else{
            uint256 beforeBal=IERC20FeeRouterV5(quote).balanceOf(address(this));
            feeEscrow.claimToken(quote);
            claimed=IERC20FeeRouterV5(quote).balanceOf(address(this))-beforeBal;
        }
        if(claimed==0) revert NoNewFees();
        uint256 vaultAmount=claimed*VAULT_BPS/BPS;
        uint256 treasuryAmount=claimed-vaultAmount;
        if(quote==address(0)){
            (bool okV,)=assetVault.call{value:vaultAmount}("");
            if(!okV) revert VaultTransferFailed();
            (bool okT,)=treasury.call{value:treasuryAmount}("");
            if(!okT) revert TreasuryTransferFailed();
        }else{
            IERC20FeeRouterV5 token=IERC20FeeRouterV5(quote);
            if(!token.transfer(assetVault,vaultAmount)) revert VaultTransferFailed();
            IAssetVaultAccountingV5(assetVault).recordTokenEarned(vaultAmount);
            if(!token.transfer(treasury,treasuryAmount)) revert TreasuryTransferFailed();
        }
        emit Harvested(quote,claimed,vaultAmount,treasuryAmount);
    }
}
