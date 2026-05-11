// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DividendDistributor is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public usdtToken;

    // distributionId => merkleRoot
    mapping(string => bytes32) public distributionRoots;
    // distributionId => user => claimed
    mapping(string => mapping(address => bool)) public hasClaimed;

    event DistributionCreated(string distributionId, bytes32 merkleRoot, uint256 totalAmount);
    event DividendClaimed(string distributionId, address indexed user, uint256 amount);

    constructor(address _usdtToken) Ownable(_msgSender()) {
        usdtToken = IERC20(_usdtToken);
    }

    function createDistribution(string calldata distributionId, bytes32 merkleRoot, uint256 totalAmount) external onlyOwner {
        require(distributionRoots[distributionId] == bytes32(0), "Distribution already exists");
        distributionRoots[distributionId] = merkleRoot;
        
        // Transfer USDT from the admin (or treasury) to this contract for distribution
        usdtToken.safeTransferFrom(_msgSender(), address(this), totalAmount);
        
        emit DistributionCreated(distributionId, merkleRoot, totalAmount);
    }

    function claim(string calldata distributionId, uint256 amount, bytes32[] calldata merkleProof) external {
        require(!hasClaimed[distributionId][_msgSender()], "Dividend already claimed");
        bytes32 merkleRoot = distributionRoots[distributionId];
        require(merkleRoot != bytes32(0), "Distribution does not exist");

        // Verify the merkle proof.
        // Ensure backend generates the leaf using keccak256(abi.encodePacked(userAddress, amount))
        bytes32 node = keccak256(abi.encodePacked(_msgSender(), amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), "Invalid merkle proof");

        hasClaimed[distributionId][_msgSender()] = true;
        usdtToken.safeTransfer(_msgSender(), amount);

        emit DividendClaimed(distributionId, _msgSender(), amount);
    }
}
