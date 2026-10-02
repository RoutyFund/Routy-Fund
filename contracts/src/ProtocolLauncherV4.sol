// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAssetRegistryV4Launcher { function approved(address) external view returns(bool); function halted(address) external view returns(bool); }
interface IPonsFactoryV4Launcher {
    struct Launch { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }
    function getLaunchedToken(address token) external view returns(Launch memory);
}
interface IRewardFactoryV4Launcher { function create(address,address) external returns(address); }
interface IVaultFactoryV4Launcher { function create(address,address,address,address) external returns(address); }
interface IRouterFactoryV4Launcher { function create(address,address,address,address,address) external returns(address); }
interface IBindVaultV4Launcher { function bindRouter(address,address) external; }
interface ISwapVaultRegistrarV4Launcher { function registerVault(address) external; }

/// @notice Routy V4 provisioner. A creator may provision their own Pons token,
/// or a narrowly scoped operator may provision it on their behalf. Creator
/// attribution is always read from Pons and can never be supplied by operator.
contract ProtocolLauncherV4 {
    enum Policy { WEIGHTED_RAFFLE, EQUAL_LOTTERY, PRO_RATA }
    struct Route { address creator; address targetAsset; address quoteToken; address vault; address router; address distributor; Policy policy; uint64 createdAt; }

    address public owner;
    address public operator;
    IAssetRegistryV4Launcher public immutable registry;
    IPonsFactoryV4Launcher public immutable ponsFactory;
    IRewardFactoryV4Launcher public immutable rewardFactory;
    IVaultFactoryV4Launcher public immutable vaultFactory;
    IRouterFactoryV4Launcher public immutable routerFactory;
    address public immutable feeEscrow;
    address public immutable treasury;
    address public immutable executor;
    mapping(address=>Route) public routes;

    event OperatorSet(address indexed previousOperator,address indexed newOperator);
    event RouteProvisionedV4(address indexed token,address indexed creator,address indexed targetAsset,address vault,address router,address distributor,address quoteToken,Policy policy,address provisionedBy);

    modifier onlyOwner(){require(msg.sender==owner,"NOT_OWNER");_;}

    constructor(address owner_,address operator_,address registry_,address ponsFactory_,address rewardFactory_,address vaultFactory_,address routerFactory_,address feeEscrow_,address treasury_,address executor_){
        require(owner_!=address(0)&&operator_!=address(0)&&registry_!=address(0)&&ponsFactory_!=address(0)&&rewardFactory_!=address(0)&&vaultFactory_!=address(0)&&routerFactory_!=address(0)&&feeEscrow_!=address(0)&&treasury_!=address(0)&&executor_!=address(0),"ZERO_ADDRESS");
        owner=owner_;operator=operator_;registry=IAssetRegistryV4Launcher(registry_);ponsFactory=IPonsFactoryV4Launcher(ponsFactory_);rewardFactory=IRewardFactoryV4Launcher(rewardFactory_);vaultFactory=IVaultFactoryV4Launcher(vaultFactory_);routerFactory=IRouterFactoryV4Launcher(routerFactory_);feeEscrow=feeEscrow_;treasury=treasury_;executor=executor_;
    }

    function setOperator(address next) external onlyOwner { require(next!=address(0),"ZERO_ADDRESS"); address previous=operator;operator=next;emit OperatorSet(previous,next); }

    function provision(address token,address asset,Policy policy) external returns(address vault,address router,address distributor){
        require(token!=address(0)&&routes[token].creator==address(0),"INVALID_TOKEN");
        require(registry.approved(asset)&&!registry.halted(asset),"ASSET_NOT_TRADABLE");
        IPonsFactoryV4Launcher.Launch memory launch=ponsFactory.getLaunchedToken(token);
        require(launch.exists&&launch.token==token,"NOT_PONS_TOKEN");
        require(msg.sender==launch.creatorFeeRecipient||msg.sender==operator,"NOT_AUTHORIZED");

        distributor=rewardFactory.create(token,asset);
        vault=vaultFactory.create(token,asset,executor,distributor);
        router=routerFactory.create(token,feeEscrow,launch.pairToken,vault,treasury);
        IBindVaultV4Launcher(vault).bindRouter(router,launch.pairToken);
        routes[token]=Route(launch.creatorFeeRecipient,asset,launch.pairToken,vault,router,distributor,policy,uint64(block.timestamp));
        ISwapVaultRegistrarV4Launcher(executor).registerVault(vault);
        emit RouteProvisionedV4(token,launch.creatorFeeRecipient,asset,vault,router,distributor,launch.pairToken,policy,msg.sender);
    }
}
