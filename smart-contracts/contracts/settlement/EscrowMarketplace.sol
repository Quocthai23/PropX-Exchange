// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EscrowMarketplace is Ownable {
    using SafeERC20 for IERC20;

    event BatchSettled(address indexed assetAddress, uint256 tradeCount);

    constructor() Ownable(_msgSender()) {}

    /**
     * @dev Settles a batch of trades on-chain.
     * The admin (backend) handles matching off-chain and executes the token transfers here.
     * Assumes users have approved EscrowMarketplace to move their asset tokens.
     */
    function batchSettle(
        address assetAddress,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(froms.length == tos.length && tos.length == amounts.length, "Array lengths must match");
        
        IERC20 asset = IERC20(assetAddress);

        for (uint256 i = 0; i < froms.length; i++) {
            asset.safeTransferFrom(froms[i], tos[i], amounts[i]);
        }

        emit BatchSettled(assetAddress, froms.length);
    }

    /**
     * @dev Settles a batch of trades on-chain using EIP-2612 permits.
     */
    function batchSettleWithPermits(
        address assetAddress,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts,
        uint256[] calldata deadlines,
        uint8[] calldata v,
        bytes32[] calldata r,
        bytes32[] calldata s
    ) external onlyOwner {
        require(froms.length == tos.length && tos.length == amounts.length, "Array lengths must match");
        require(amounts.length == deadlines.length && deadlines.length == v.length && v.length == r.length && r.length == s.length, "Permit lengths must match");
        
        IERC20 asset = IERC20(assetAddress);

        for (uint256 i = 0; i < froms.length; i++) {
            IERC20Permit(assetAddress).permit(froms[i], address(this), amounts[i], deadlines[i], v[i], r[i], s[i]);
            asset.safeTransferFrom(froms[i], tos[i], amounts[i]);
        }

        emit BatchSettled(assetAddress, froms.length);
    }
}
