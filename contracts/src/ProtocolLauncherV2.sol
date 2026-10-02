// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAssetRegistryV2Launcher {
    function approved(address) external view returns(bool);
    function halted(address) external view returns(bool);
}

interface IPonsFactoryV2Launcher {
    struct Launch {
        address token;
        address curve;
        address deployer;
        address creatorFeeRecipient;
        address pairToken;
        uint256 graduationThreshold;
        uint24 poolFee;
        int24 tickSpacing;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        uint8 phase;
        uint256 sweptQuote;
        uint256 sweptTokens;
        uint256 sweptAt;
        bool exists;
    }
    function getLaunchedToken(address token) external view returns(Launch memory);
}

interface IRewardFactoryV2Launcher {
    function create(address routeToken,address rewardAsset) external returns(address);
}

interface IVaultFactoryV2Launcher {
    function create(address token,address targetAsset,address executor,address distributor) external returns(address);
}

interface IRouterFactoryV2Launcher {
    function create(address token,address escrow,address quoteToken,address vault,address treasury) external returns(address);
}

interface IBindVaultV2Launcher {
    function bindRouter(address router,address quoteToken) external;
}

interface ISwapVaultRegistrarV2Launcher {
    function registerVault(address vault) external;
}

/// @notice Provisioner for new Reward V2 routes. This contract is intentionally
/// separate from the immutable V1 launcher so existing production routes remain unchanged.
contract ProtocolLauncherV2 {
    enum Policy { WEIGHTED_RAFFLE, EQUAL_LOTTERY, PRO_RATA }

    struct Route {
        address creator;
        address targetAsset;
        address quoteToken;
        address vault;
        address router;
        address distributor;
        Policy policy;
        uint64 createdAt;
    }

    IAssetRegistryV2Launcher public immutable registry;
    IPonsFactoryV2Launcher public immutable ponsFactory;
    IRewardFactoryV2Launcher public immutable rewardFactory;
    IVaultFactoryV2Launcher public immutable vaultFactory;
    IRouterFactoryV2Launcher public immutable routerFactory;
    address public immutable feeEscrow;
    address public immutable treasury;
    address public immutable executor;

    mapping(address => Route) public routes;

    event RouteProvisionedV2(
        address indexed token,
        address indexed creator,
        address indexed targetAsset,
        address vault,
        address router,
        address distributor,
        address quoteToken,
        Policy policy
    );

    constructor(
        address registry_,
        address ponsFactory_,
        address rewardFactory_,
        address vaultFactory_,
        address routerFactory_,
        address feeEscrow_,
        address treasury_,
        address executor_
    ) {
        require(
            registry_ != address(0) &&
            ponsFactory_ != address(0) &&
            rewardFactory_ != address(0) &&
            vaultFactory_ != address(0) &&
            routerFactory_ != address(0) &&
            feeEscrow_ != address(0) &&
            treasury_ != address(0) &&
            executor_ != address(0),
            "ZERO_ADDRESS"
        );
        registry = IAssetRegistryV2Launcher(registry_);
        ponsFactory = IPonsFactoryV2Launcher(ponsFactory_);
        rewardFactory = IRewardFactoryV2Launcher(rewardFactory_);
        vaultFactory = IVaultFactoryV2Launcher(vaultFactory_);
        routerFactory = IRouterFactoryV2Launcher(routerFactory_);
        feeEscrow = feeEscrow_;
        treasury = treasury_;
        executor = executor_;
    }

    function provision(address token,address asset,Policy policy)
        external
        returns(address vault,address router,address distributor)
    {
        require(token != address(0) && routes[token].creator == address(0), "INVALID_TOKEN");
        require(registry.approved(asset) && !registry.halted(asset), "ASSET_NOT_TRADABLE");

        IPonsFactoryV2Launcher.Launch memory launch = ponsFactory.getLaunchedToken(token);
        require(launch.exists && launch.token == token, "NOT_PONS_TOKEN");
        require(launch.creatorFeeRecipient == msg.sender, "NOT_FEE_RECIPIENT");

        distributor = rewardFactory.create(token, asset);
        vault = vaultFactory.create(token, asset, executor, distributor);
        router = routerFactory.create(token, feeEscrow, launch.pairToken, vault, treasury);
        IBindVaultV2Launcher(vault).bindRouter(router, launch.pairToken);

        routes[token] = Route(
            msg.sender,
            asset,
            launch.pairToken,
            vault,
            router,
            distributor,
            policy,
            uint64(block.timestamp)
        );

        ISwapVaultRegistrarV2Launcher(executor).registerVault(vault);

        emit RouteProvisionedV2(
            token,
            msg.sender,
            asset,
            vault,
            router,
            distributor,
            launch.pairToken,
            policy
        );
    }
}
