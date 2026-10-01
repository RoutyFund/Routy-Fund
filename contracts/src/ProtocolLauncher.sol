// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IAssetRegistry{function approved(address)external view returns(bool);function halted(address)external view returns(bool);}
interface IPonsFactory{struct Launch{address token;address curve;address deployer;address creatorFeeRecipient;address pairToken;uint256 graduationThreshold;uint24 poolFee;int24 tickSpacing;uint16 creatorTaxBps;bool buybackEnabled;uint8 phase;uint256 sweptQuote;uint256 sweptTokens;uint256 sweptAt;bool exists;}function getLaunchedToken(address token)external view returns(Launch memory);}
interface IVaultFactory{function create(address token,address targetAsset,address executor)external returns(address);}
interface IRouterFactory{function create(address token,address escrow,address quoteToken,address vault,address treasury)external returns(address);}
interface IBindVault{function bindRouter(address,address)external;}
interface ISwapVaultRegistrar{function registerVault(address)external;}
contract ProtocolLauncher {
 enum Policy{WEIGHTED_RAFFLE,EQUAL_LOTTERY,PRO_RATA}
 struct Route{address creator;address targetAsset;address quoteToken;address vault;address router;Policy policy;uint64 createdAt;}
 IAssetRegistry public immutable registry; IPonsFactory public immutable ponsFactory; IVaultFactory public immutable vaultFactory; IRouterFactory public immutable routerFactory;
 address public immutable feeEscrow; address public immutable treasury; address public immutable executor; mapping(address=>Route) public routes;
 event RouteProvisioned(address indexed token,address indexed creator,address indexed targetAsset,address vault,address router,address quoteToken,Policy policy);
 constructor(address r,address p,address vf,address rf,address escrow,address treasury_,address executor_){require(r!=address(0)&&p!=address(0)&&vf!=address(0)&&rf!=address(0)&&escrow!=address(0)&&treasury_!=address(0)&&executor_!=address(0),"ZERO_ADDRESS");registry=IAssetRegistry(r);ponsFactory=IPonsFactory(p);vaultFactory=IVaultFactory(vf);routerFactory=IRouterFactory(rf);feeEscrow=escrow;treasury=treasury_;executor=executor_;}
 function provision(address token,address asset,Policy policy) external returns(address vault,address router){require(token!=address(0)&&routes[token].creator==address(0),"INVALID_TOKEN");require(registry.approved(asset)&&!registry.halted(asset),"ASSET_NOT_TRADABLE");IPonsFactory.Launch memory launch=ponsFactory.getLaunchedToken(token);require(launch.exists&&launch.token==token,"NOT_PONS_TOKEN");require(launch.creatorFeeRecipient==msg.sender,"NOT_FEE_RECIPIENT");vault=vaultFactory.create(token,asset,executor);router=routerFactory.create(token,feeEscrow,launch.pairToken,vault,treasury);IBindVault(vault).bindRouter(router,launch.pairToken);routes[token]=Route(msg.sender,asset,launch.pairToken,vault,router,policy,uint64(block.timestamp));ISwapVaultRegistrar(executor).registerVault(vault);emit RouteProvisioned(token,msg.sender,asset,vault,router,launch.pairToken,policy);}
}
