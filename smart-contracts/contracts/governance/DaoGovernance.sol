// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IAssetToken {
    function updateTokenomics(uint256 _retained, uint256 _released) external;
    function retainedTokenPercentage() external view returns (uint256);
    function releasedTokenPercentage() external view returns (uint256);
}

contract DaoGovernance is Ownable {
    enum ProposalStatus { ACTIVE, PASSED, REJECTED, EXECUTED }
    enum ProposalType { GENERAL, INCREASE_RELEASED_TOKEN_PERCENTAGE }

    struct Proposal {
        uint256 id;
        address assetToken;
        ProposalType pType;
        uint256 newRetainedPercentage;
        uint256 newReleasedPercentage;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 snapshotTimestamp;
        uint256 endTime;
        ProposalStatus status;
        bool executed;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 id, address assetToken, ProposalType pType, uint256 endTime);
    event Voted(uint256 proposalId, address voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 id);

    constructor() Ownable(_msgSender()) {}
    
    function createTokenomicsProposal(
        address assetToken,
        uint256 newRetained,
        uint256 newReleased,
        uint256 durationInSeconds
    ) external onlyOwner returns (uint256) {
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.id = proposalCount;
        p.assetToken = assetToken;
        p.pType = ProposalType.INCREASE_RELEASED_TOKEN_PERCENTAGE;
        p.newRetainedPercentage = newRetained;
        p.newReleasedPercentage = newReleased;
        p.snapshotTimestamp = block.timestamp;
        p.endTime = block.timestamp + durationInSeconds;
        p.status = ProposalStatus.ACTIVE;

        emit ProposalCreated(proposalCount, assetToken, p.pType, p.endTime);
        return proposalCount;
    }

    function castVote(uint256 proposalId, address voter, bool support, uint256 weight) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.endTime, "Voting has ended");
        require(!hasVoted[proposalId][voter], "Already voted");

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        hasVoted[proposalId][voter] = true;
        emit Voted(proposalId, voter, support, weight);
    }

    function executeProposal(uint256 proposalId) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.endTime, "Voting has not ended");
        require(!p.executed, "Already executed");

        if (p.forVotes > p.againstVotes) {
            p.status = ProposalStatus.PASSED;
            if (p.pType == ProposalType.INCREASE_RELEASED_TOKEN_PERCENTAGE) {
                IAssetToken(p.assetToken).updateTokenomics(p.newRetainedPercentage, p.newReleasedPercentage);
            }
        } else {
            p.status = ProposalStatus.REJECTED;
        }

        p.executed = true;
        emit ProposalExecuted(proposalId);
    }
}
