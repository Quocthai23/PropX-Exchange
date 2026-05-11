// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IKycRegistry {
    function isWhitelisted(address account) external view returns (bool);
}

contract KycRegistry is IKycRegistry, Ownable {
    mapping(address => bool) public whitelisted;

    event KycStatusUpdated(address indexed account, bool isWhitelisted);

    constructor() Ownable(_msgSender()) {}

    function updateKycStatus(address account, bool _isWhitelisted) external onlyOwner {
        whitelisted[account] = _isWhitelisted;
        emit KycStatusUpdated(account, _isWhitelisted);
    }

    function isWhitelisted(address account) external view override returns (bool) {
        return whitelisted[account];
    }
}
