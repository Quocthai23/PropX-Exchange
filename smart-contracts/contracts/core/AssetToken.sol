// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./KycRegistry.sol";

contract AssetToken is ERC20, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public retainedTokenPercentage;
    uint256 public releasedTokenPercentage;
    IKycRegistry public kycRegistry;

    event TokenomicsUpdated(uint256 retained, uint256 released);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address admin,
        uint256 _retainedTokenPercentage,
        uint256 _releasedTokenPercentage,
        address _kycRegistry
    ) ERC20(name, symbol) ERC20Permit(name) {
        require(_retainedTokenPercentage + _releasedTokenPercentage == 100, "Percentages must sum to 100");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);

        retainedTokenPercentage = _retainedTokenPercentage;
        releasedTokenPercentage = _releasedTokenPercentage;
        kycRegistry = IKycRegistry(_kycRegistry);

        if (initialSupply > 0) {
            _mint(admin, initialSupply);
        }
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }

    function burnFrom(address account, uint256 amount) public onlyRole(BURNER_ROLE) {
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }

    function updateTokenomics(uint256 _retained, uint256 _released) public onlyRole(ADMIN_ROLE) {
        require(_retained + _released == 100, "Percentages must sum to 100");
        retainedTokenPercentage = _retained;
        releasedTokenPercentage = _released;
        emit TokenomicsUpdated(_retained, _released);
    }

    function updateKycRegistry(address _kycRegistry) external onlyRole(ADMIN_ROLE) {
        kycRegistry = IKycRegistry(_kycRegistry);
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (address(kycRegistry) != address(0) && to != address(0) && to != address(this)) {
            require(kycRegistry.isWhitelisted(to), "Receiver is not KYC whitelisted");
        }
        super._update(from, to, value);
    }
}
