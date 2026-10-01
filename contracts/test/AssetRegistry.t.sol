// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../src/AssetRegistry.sol";

contract AssetRegistryTest {
    function testOwnerCanApprove() public {
        AssetRegistry r=new AssetRegistry(address(this));
        address asset=address(0x1234);
        r.setApproved(asset,true);
        require(r.approved(asset),"NOT_APPROVED");
    }
}
