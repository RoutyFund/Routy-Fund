// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IPonsV2FeeEscrow{
 function credit(address recipient)external payable;
 function creditToken(address recipient,address token,uint256 amount)external;
 function claim()external returns(uint256 amount);
 function claim(uint256 amount)external returns(uint256);
 function claimToken(address token)external returns(uint256 amount);
 function claimToken(address token,uint256 amount)external returns(uint256);
 function balanceOf(address recipient)external view returns(uint256);
 function balanceOfToken(address recipient,address token)external view returns(uint256);
}