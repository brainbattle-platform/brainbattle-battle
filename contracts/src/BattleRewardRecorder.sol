// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IBrainPointToken {
    function mint(address to, uint256 amount) external;
}

contract BattleRewardRecorder is Ownable {
    enum BattleMode {
        DUEL_1V1,
        TEAM_3V3
    }

    enum MatchOutcome {
        WIN,
        LOSE,
        DRAW,
        CANCELLED,
        AFK
    }

    enum RewardType {
        ParticipationReward,
        WinReward,
        DrawReward,
        LoseReward,
        PerformanceReward,
        StreakBonus,
        SeasonReward
    }

    struct RewardItemInput {
        RewardType rewardType;
        uint256 amountBp;
    }

    struct PlayerRewardInput {
        address player;
        MatchOutcome outcome;
        uint256 totalBp;
        RewardItemInput[] breakdown;
    }

    struct BattleRecord {
        bytes32 matchId;
        BattleMode mode;
        bytes32 resultHash;
        uint256 recordedAt;
        bool exists;
    }

    IBrainPointToken public immutable brainPointToken;
    address public operator;

    mapping(bytes32 => BattleRecord) public battleRecords;

    event BattleRecorded(
        bytes32 indexed matchId,
        BattleMode mode,
        bytes32 resultHash,
        uint256 recordedAt
    );

    event PlayerRewardMinted(
        bytes32 indexed matchId,
        address indexed player,
        MatchOutcome outcome,
        uint256 totalBp
    );

    event RewardBreakdownLogged(
        bytes32 indexed matchId,
        address indexed player,
        RewardType rewardType,
        uint256 amountBp
    );

    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);

    error NotOperator();
    error InvalidOperator();
    error InvalidMatchId();
    error MatchAlreadyRecorded();
    error InvalidPlayerCount();
    error InvalidPlayerAddress();
    error InvalidTotalBp();

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert NotOperator();
        }
        _;
    }

    constructor(address initialOwner, address tokenAddress, address initialOperator) Ownable(initialOwner) {
        if (tokenAddress == address(0)) {
            revert InvalidOperator();
        }
        if (initialOperator == address(0)) {
            revert InvalidOperator();
        }

        brainPointToken = IBrainPointToken(tokenAddress);
        operator = initialOperator;
    }

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) {
            revert InvalidOperator();
        }

        address oldOperator = operator;
        operator = newOperator;

        emit OperatorUpdated(oldOperator, newOperator);
    }

    function recordBattleResult(
        bytes32 matchId,
        BattleMode mode,
        bytes32 resultHash,
        PlayerRewardInput[] calldata rewards
    ) external onlyOperator {
        if (matchId == bytes32(0)) {
            revert InvalidMatchId();
        }

        if (battleRecords[matchId].exists) {
            revert MatchAlreadyRecorded();
        }

        if (mode == BattleMode.DUEL_1V1) {
            if (rewards.length != 2) {
                revert InvalidPlayerCount();
            }
        } else if (mode == BattleMode.TEAM_3V3) {
            if (rewards.length != 6) {
                revert InvalidPlayerCount();
            }
        } else {
            revert InvalidPlayerCount();
        }

        for (uint256 i = 0; i < rewards.length; i++) {
            if (rewards[i].player == address(0)) {
                revert InvalidPlayerAddress();
            }

            uint256 sum = 0;
            for (uint256 j = 0; j < rewards[i].breakdown.length; j++) {
                sum += rewards[i].breakdown[j].amountBp;
            }

            if (sum != rewards[i].totalBp) {
                revert InvalidTotalBp();
            }
        }

        battleRecords[matchId] = BattleRecord({
            matchId: matchId,
            mode: mode,
            resultHash: resultHash,
            recordedAt: block.timestamp,
            exists: true
        });

        emit BattleRecorded(matchId, mode, resultHash, block.timestamp);

        for (uint256 i = 0; i < rewards.length; i++) {
            brainPointToken.mint(rewards[i].player, rewards[i].totalBp);

            emit PlayerRewardMinted(
                matchId,
                rewards[i].player,
                rewards[i].outcome,
                rewards[i].totalBp
            );

            for (uint256 j = 0; j < rewards[i].breakdown.length; j++) {
                emit RewardBreakdownLogged(
                    matchId,
                    rewards[i].player,
                    rewards[i].breakdown[j].rewardType,
                    rewards[i].breakdown[j].amountBp
                );
            }
        }
    }
}