// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AssetToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AssetTokenFactory is Ownable {
    event AssetTokenCreated(address indexed tokenAddress, string name, string symbol, uint256 totalSupply);

    constructor() Ownable(_msgSender()) {}

    function createAssetToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        address kycRegistry
    ) external onlyOwner returns (address) {
        // By default, assume 100% retained token percentage for newly created tokens
        AssetToken newToken = new AssetToken(
            name,
            symbol,
            totalSupply,
            owner(), // Admin gets the total supply and roles
            100, // 100% retained
            0,    // 0% released initially
            kycRegistry
        );

        emit AssetTokenCreated(address(newToken), name, symbol, totalSupply);
        
        return address(newToken);
    }
}
