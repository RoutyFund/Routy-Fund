// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/SwapExecutor.sol";
contract SwapExecutorTest {
 function testPreProductionExecutorCannotUnpause() public {
  SwapExecutor e=new SwapExecutor(address(this));
  require(e.paused(),"NOT_PAUSED");
  try e.setPaused(false){revert("SHOULD_REVERT");}catch{}
 }
}