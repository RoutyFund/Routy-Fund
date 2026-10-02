// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAssetRegistryV5Launcher { function approved(address) external view returns(bool); function halted(address) external view returns(bool); }
interface IPonsFactoryV5Launcher {
    struct Launch { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }
    function getLaunchedToken(address token) external view returns(Launch memory);
}
interface IRewardFactoryV5Launcher { function create(address,address) external returns(address); }
interface IVaultFactoryV5Launcher { function create(address,address,address,address) external returns(address); }
interface IFeeRouterFactoryV5Launcher {
    function creatorForRouter(address) external view returns(address);
    function bind(address,address,address,address) external;
}
interface IBindVaultV5Launcher { function bindRouter(address,address) external; }
interface ISwapVaultRegistrarV5Launcher { function registerVault(address) external; }

contract ProtocolLauncherV5 {
    enum Policy { WEIGHTED_RAFFLE, EQUAL_LOTTERY, PRO_RATA }
    struct Route { address creator; address targetAsset; address quoteToken; address vault; address router; address distributor; Policy policy; uint64 createdAt; }

    address public owner;
    address public operator;
    IAssetRegistryV5Launcher public immutable registry;
    IPonsFactoryV5Launcher public immutable ponsFactory;
    IRewardFactoryV5Launcher public immutable rewardFactory;
    IVaultFactoryV5Launcher public immutable vaultFactory;
    IFeeRouterFactoryV5Launcher public immutable routerFactory;
    address public immutable executor;
    mapping(address=>Route) public routes;

    event OperatorSet(address indexed previousOperator,address indexed newOperator);
    event RouteProvisionedV5(address indexed token,address indexed creator,address indexed targetAsset,address vault,address router,address distributor,address quoteToken,Policy policy,address provisionedBy);

    modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}

    constructor(address owner_,address operator_,address registry_,address ponsFactory_,address rewardFactory_,address vaultFactory_,address routerFactory_,address executor_){
        require(owner_!=address(0)&&operator_!=address(0)&&registry_!=address(0)&&ponsFactory_!=address(0)&&rewardFactory_!=address(0)&&vaultFactory_!=address(0)&&routerFactory_!=address(0)&&executor_!=address(0),"ZERO_ADDRESS");
        owner=owner_;operator=operator_;registry=IAssetRegistryV5Launcher(registry_);ponsFactory=IPonsFactoryV5Launcher(ponsFactory_);rewardFactory=IRewardFactoryV5Launcher(rewardFactory_);vaultFactory=IVaultFactoryV5Launcher(vaultFactory_);routerFactory=IFeeRouterFactoryV5Launcher(routerFactory_);executor=executor_;
    }

    function setOperator(address next) external onlyOwner {require(next!=address(0),"ZERO_ADDRESS");address previous=operator;operator=next;emit OperatorSet(previous,next);}

    function provision(address token,address asset,Policy policy) external returns(address vault,address router,address distributor){
        require(token!=address(0)&&routes[token].creator==address(0),"INVALID_TOKEN");
        require(registry.approved(asset)&&!registry.halted(asset),"ASSET_NOT_TRADABLE");
        IPonsFactoryV5Launcher.Launch memory launch=ponsFactory.getLaunchedToken(token);
        require(launch.exists&&launch.token==token,"NOT_PONS_TOKEN");
        address creator=launch.deployer;
        router=launch.creatorFeeRecipient;
        require(creator!=address(0)&&routerFactory.creatorForRouter(router)==creator,"ROUTER_CREATOR_MISMATCH");
        require(msg.sender==creator||msg.sender==operator,"NOT_AUTHORIZED");

        distributor=rewardFactory.create(token,asset);
        vault=vaultFactory.create(token,asset,executor,distributor);
        routerFactory.bind(router,token,launch.pairToken,vault);
        IBindVaultV5Launcher(vault).bindRouter(router,launch.pairToken);
        routes[token]=Route(creator,asset,launch.pairToken,vault,router,distributor,policy,uint64(block.timestamp));
        ISwapVaultRegistrarV5Launcher(executor).registerVault(vault);
        emit RouteProvisionedV5(token,creator,asset,vault,router,distributor,launch.pairToken,policy,msg.sender);
    }
}
