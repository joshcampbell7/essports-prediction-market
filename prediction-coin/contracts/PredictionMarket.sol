// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PredictionMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant VIRTUAL_LIQUIDITY = 100e6; // 100 USDC (6dp)

    enum Outcome {
        NO,
        YES
    }

    struct Market {
        uint256 id;
        string question;
        string marketType;
        string oracleUrl;
        uint256 closeTime;
        bool resolved;
        Outcome winningOutcome;
        uint256 totalPool; // REAL liquidity only
        mapping(uint256 => uint256) outcomePools; // REAL pools
        mapping(address => mapping(uint256 => uint256)) userBets;
    }

    IERC20 public immutable paymentToken;
    uint256 public marketCounter;
    mapping(uint256 => Market) public markets;

    uint256 public constant MIN_BET = 1e6;

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string marketType,
        string oracleUrl,
        uint256 closeTime
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed user,
        Outcome outcome,
        uint256 amount,
        uint256 yesPrice, // 0–100
        uint256 noPrice
    );

    event MarketResolved(uint256 indexed marketId, Outcome winningOutcome);
    event PayoutClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    error MarketNotFound();
    error MarketClosed();
    error MarketResolvedAlready();
    error MarketNotResolved();
    error InvalidAmount();
    error NoWinnings();

    constructor(address _token, address _owner) Ownable(_owner) {
        paymentToken = IERC20(_token);
    }

    /*//////////////////////////////////////////////////////////////
                              MARKETS
    //////////////////////////////////////////////////////////////*/

    function createMarket(
        string calldata _question,
        string calldata _marketType,
        string calldata _oracleUrl,
        uint256 _closeTime
    ) external onlyOwner returns (uint256) {
        if (_closeTime <= block.timestamp) revert InvalidAmount();

        marketCounter++;
        Market storage m = markets[marketCounter];
        m.id = marketCounter;
        m.question = _question;
        m.marketType = _marketType;
        m.oracleUrl = _oracleUrl;
        m.closeTime = _closeTime;

        emit MarketCreated(
            marketCounter,
            _question,
            _marketType,
            _oracleUrl,
            _closeTime
        );

        return marketCounter;
    }

    /*//////////////////////////////////////////////////////////////
                              BETTING
    //////////////////////////////////////////////////////////////*/

    function placeBet(
        uint256 _marketId,
        Outcome _outcome,
        uint256 _amount
    ) external {
        Market storage m = markets[_marketId];
        if (m.id == 0) revert MarketNotFound();
        if (block.timestamp >= m.closeTime) revert MarketClosed();
        if (m.resolved) revert MarketResolvedAlready();
        if (_amount < MIN_BET) revert InvalidAmount();

        // Capture PRE-trade prices
        (uint256 yesPrice, uint256 noPrice) = getPrices(_marketId);

        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 o = uint256(_outcome);
        m.userBets[msg.sender][o] += _amount;
        m.outcomePools[o] += _amount;
        m.totalPool += _amount;

        emit BetPlaced(
            _marketId,
            msg.sender,
            _outcome,
            _amount,
            yesPrice,
            noPrice
        );
    }

    /*//////////////////////////////////////////////////////////////
                             RESOLUTION
    //////////////////////////////////////////////////////////////*/

    function resolveMarket(
        uint256 _marketId,
        Outcome _winner
    ) external onlyOwner {
        Market storage m = markets[_marketId];
        if (m.id == 0) revert MarketNotFound();
        if (m.resolved) revert MarketResolvedAlready();
        // Allow early resolution - once outcome is known, resolve immediately
        // closeTime only prevents new bets, not resolution

        m.resolved = true;
        m.winningOutcome = _winner;

        emit MarketResolved(_marketId, _winner);
    }

    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage m = markets[_marketId];
        if (!m.resolved) revert MarketNotResolved();

        uint256 o = uint256(m.winningOutcome);
        uint256 userBet = m.userBets[msg.sender][o];
        if (userBet == 0) revert NoWinnings();

        uint256 payout = (userBet * m.totalPool) / m.outcomePools[o];
        m.userBets[msg.sender][o] = 0;

        paymentToken.safeTransfer(msg.sender, payout);
        emit PayoutClaimed(_marketId, msg.sender, payout);
    }

    /*//////////////////////////////////////////////////////////////
                           PRICING (VIEW)
    //////////////////////////////////////////////////////////////*/

    function getPricingPools(
        uint256 _marketId
    ) public view returns (uint256 yesPool, uint256 noPool) {
        Market storage m = markets[_marketId];
        if (m.id == 0) revert MarketNotFound();

        yesPool = m.outcomePools[uint256(Outcome.YES)] + VIRTUAL_LIQUIDITY;
        noPool = m.outcomePools[uint256(Outcome.NO)] + VIRTUAL_LIQUIDITY;
    }

    function getPrices(
        uint256 _marketId
    ) public view returns (uint256 yesPrice, uint256 noPrice) {
        (uint256 y, uint256 n) = getPricingPools(_marketId);
        uint256 total = y + n;

        yesPrice = (y * 100) / total;
        noPrice = (n * 100) / total;
    }

    function getOdds(
        uint256 _marketId
    ) external view returns (uint256 yesOdds, uint256 noOdds) {
        (uint256 y, uint256 n) = getPricingPools(_marketId);
        uint256 total = y + n;

        yesOdds = (y * 1e18) / total;
        noOdds = (n * 1e18) / total;
    }

    /*//////////////////////////////////////////////////////////////
                           MARKET INFO (VIEW)
    //////////////////////////////////////////////////////////////*/

    function getMarketInfo(
        uint256 _marketId
    )
        external
        view
        returns (
            string memory question,
            string memory marketType,
            string memory oracleUrl,
            uint256 closeTime,
            bool resolved,
            uint8 winningOutcome,
            uint256 totalPool
        )
    {
        Market storage m = markets[_marketId];
        if (m.id == 0) revert MarketNotFound();

        return (
            m.question,
            m.marketType,
            m.oracleUrl,
            m.closeTime,
            m.resolved,
            uint8(m.winningOutcome),
            m.totalPool
        );
    }

    function getOutcomePool(
        uint256 _marketId,
        uint8 _outcome
    ) external view returns (uint256) {
        Market storage m = markets[_marketId];
        if (m.id == 0) revert MarketNotFound();
        return m.outcomePools[_outcome];
    }

    function getUserBet(
        uint256 _marketId,
        address _user,
        uint8 _outcome
    ) external view returns (uint256) {
        Market storage m = markets[_marketId];
        if (m.id == 0) revert MarketNotFound();
        return m.userBets[_user][_outcome];
    }
}
