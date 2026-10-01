// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IAssetRegistry{function approved(address)external view returns(bool);function halted(address)external view returns(bool);}
interface IPonsFactory{struct Launch{address token;address curve;address deployer;address creatorFeeRecipient;address pairToken;uint256 graduationThreshold;uint24 poolFee;int24 tickSpacing;uint16 creatorTaxBps;bool buybackEnabled;uint8 phase;uint256 sweptQuote;uint256 sweptTokens;uint256 sweptAt;bool exists;}function getLaunchedToken(address token)external view returns(Launch memory);}
contract ProtocolLauncher {
 enum Policy{WEIGHTED_RAFFLE,EQUAL_LOTTERY,PRO_RATA}
 struct Route{address creator;address targetAsset;address quoteToken;Policy policy;uint64 createdAt;}
 IAssetRegistry public immutable registry;IPonsFactory public immutable ponsFactory;
 mapping(address=>Route) public routes;
 event RouteRegistered(address indexed token,address indexed creator,address indexed targetAsset,address quoteToken,Policy policy);
 constructor(address r,address p){require(r!=address(0)&&p!=address(0),"ZERO_ADDRESS");registry=IAssetRegistry(r);ponsFactory=IPonsFactory(p);}
 function register(address token,address asset,Policy policy) external {require(token!=address(0),"ZERO_TOKEN");require(routes[token].creator==address(0),"EXISTS");require(registry.approved(asset)&&!registry.halted(asset),"ASSET_NOT_TRADABLE");IPonsFactory.Launch memory launch=ponsFactory.getLaunchedToken(token);require(launch.exists&&launch.token==token,"NOT_PONS_TOKEN");require(launch.creatorFeeRecipient==msg.sender,"NOT_FEE_RECIPIENT");routes[token]=Route(msg.sender,asset,launch.pairToken,policy,uint64(block.timestamp));emit RouteRegistered(token,msg.sender,asset,launch.pairToken,policy);}
}
