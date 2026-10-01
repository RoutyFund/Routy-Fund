// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAdapterERC20 {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address,address,uint256) external returns (bool);
}

interface IAdapterPermit2 {
    function approve(address token,address spender,uint160 amount,uint48 expiration) external;
}

interface IAdapterRouter {
    function execute(bytes calldata commands,bytes[] calldata inputs,uint256 deadline) external payable;
}

contract SwapRouterAdapter {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    address public constant UNIVERSAL_ROUTER = 0x204FAca1764B154221e35c0d20aBb3c525710498;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    error InvalidPool();
    error InvalidValue();
    error TokenCallFailed();

    function validatePool(address quote,address target,PoolKey calldata key) external pure returns (bool) {
        _validatePool(quote,target,key);
        return true;
    }

    function swap(
        address vault,
        address quote,
        address target,
        PoolKey calldata key,
        uint256 amountIn,
        uint256 minOut,
        uint256 deadline
    ) external payable {
        _validatePool(quote,target,key);
        if (vault == address(0) || amountIn == 0 || minOut == 0) revert InvalidValue();

        uint256 beforeBalance;
        if (quote == address(0)) {
            if (msg.value != amountIn) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            beforeBalance = IAdapterERC20(quote).balanceOf(address(this));
            _callToken(quote,abi.encodeWithSelector(0x23b872dd,msg.sender,address(this),amountIn));
            if (IAdapterERC20(quote).balanceOf(address(this)) != beforeBalance + amountIn) revert InvalidValue();
            _callToken(quote,abi.encodeWithSelector(0x095ea7b3,PERMIT2,0));
            _callToken(quote,abi.encodeWithSelector(0x095ea7b3,PERMIT2,amountIn));
            IAdapterPermit2(PERMIT2).approve(quote,UNIVERSAL_ROUTER,uint160(amountIn),uint48(deadline));
        }

        bool zeroForOne = quote == key.currency0;
        bytes memory actions = abi.encodePacked(bytes1(uint8(0x06)),bytes1(uint8(0x0c)),bytes1(uint8(0x0e)));
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(key,zeroForOne,uint128(amountIn),uint128(minOut),uint256(0),bytes(""));
        params[1] = abi.encode(quote,amountIn);
        params[2] = abi.encode(target,vault,type(uint256).max);
        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(actions,params);
        IAdapterRouter(UNIVERSAL_ROUTER).execute{value: quote == address(0) ? amountIn : 0}(
            abi.encodePacked(bytes1(uint8(0x10))),
            inputs,
            deadline
        );

        if (quote != address(0)) {
            IAdapterPermit2(PERMIT2).approve(quote,UNIVERSAL_ROUTER,0,0);
            _callToken(quote,abi.encodeWithSelector(0x095ea7b3,PERMIT2,0));
            if (IAdapterERC20(quote).balanceOf(address(this)) != beforeBalance) revert InvalidValue();
        }
    }

    function _validatePool(address quote,address target,PoolKey calldata key) private pure {
        if (
            key.currency0 >= key.currency1 ||
            !((key.currency0 == quote && key.currency1 == target) || (key.currency0 == target && key.currency1 == quote)) ||
            key.fee > 1_000_000 ||
            key.tickSpacing <= 0 ||
            key.tickSpacing > 32_767 ||
            key.hooks != address(0)
        ) revert InvalidPool();
    }

    function _callToken(address token,bytes memory data) private {
        (bool ok,bytes memory result)=token.call(data);
        if (!ok || (result.length != 0 && !abi.decode(result,(bool)))) revert TokenCallFailed();
    }
}
