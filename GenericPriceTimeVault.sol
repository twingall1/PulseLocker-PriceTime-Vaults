// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.20;

// ---------------------------------------------------------------------
// PulseLocker Generic Price-Time Vault (Immutable)
//
// This contract holds a user's tokens or PLS until *either*:
//
//   (1) A target price condition is met, OR
//   (2) A specific unlock time is reached.
//
// Once one of these conditions is satisfied, the owner may withdraw.
//
// ---------------------------------------------------------------------
// FIXED FEE
//
// A single fixed fee of 0.5% is deducted *only at the moment of withdrawal*.
// There are:
//
//   - No deposit fees
//   - No ongoing fees
//   - No management fees
//   - No hidden routes or repeated deductions
//   - No owner-controlled fee changes
//
// The fee is routed to a fixed, immutable address and cannot be altered
// after deployment. All values are deterministic and transparent.
// ---------------------------------------------------------------------
//
// CONTRACT CHARACTERISTICS
//
// - Fully immutable: no proxy, no upgrade hooks
// - No admin privileges and no owner-only methods
// - Deterministic logic for both price and time unlocking
// - Supports both native PLS and ERC20 tokens
// - Events emitted for all price-feed decisions
//
// The internal structure consolidates fee calculation and transfers into
// helper functions to improve clarity and reduce accidental misuse.
// This does NOT change behaviour or add any form of dynamic logic.
// ---------------------------------------------------------------------



interface IERC20Generic {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IUniswapV2PairGeneric {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves()
        external
        view
        returns ( uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast );
}

/**
 * @title GenericPriceTimeVault
 *
 * @notice
 *  USD-native price locks, dual feeds, time-first unlock.
 *
 *  - priceThreshold is **USD per 1 whole lock token, scaled by 1e18**.
 *    e.g. threshold = parseUnits("0.0044", 18) means "1 HEX ≥ $0.0044".
 *
 *  - Each feed returns a USD price for 1 full lock token as:
 *
 *        rawPrice1e18 = quoteRes * 1e18 / lockRes
 *        priceUsd1e18  = rawPrice1e18 * 10^(lockDecimals - quoteDecimals)
 *                     or rawPrice1e18 / 10^(quoteDecimals - lockDecimals)
 *
 *  - priceConditionMet(), currentPrice1e18(), priceDetail() all work in
 *    "USD × 1e18" units.
 *
 *  - Feed selection is by USD-normalized quote reserves:
 *
 *        normalized = quoteRes * 10^(18 - quoteDecimals)
 *
 *  - Time unlock is always checked first (unbrickable).
 *  - priceDetail() signature preserved for frontend transparency.
 */
contract GenericPriceTimeVault {
    address public constant FEE_RECIPIENT =
        0x0E4519E78E3c4bd16C7500E41d4605e54c7CD3b4;

    address public immutable owner;
    address public immutable lockToken;

    address public immutable primaryQuoteToken;
    address public immutable backupQuoteToken;

    IUniswapV2PairGeneric public immutable primaryPair;
    IUniswapV2PairGeneric public immutable backupPair;

    bool public immutable isNative;

    bool public immutable primaryLockTokenIsToken0;
    bool public immutable backupLockTokenIsToken0;

    uint8 public immutable lockTokenDecimals;
    uint8 public immutable primaryQuoteDecimals;
    uint8 public immutable backupQuoteDecimals;

    uint256 public immutable priceThreshold; // USD × 1e18
    uint256 public immutable unlockTime;
    uint256 public immutable startTime;

    bool public withdrawn;

    event Withdrawn(
        address indexed owner,
        uint256 amount,
        uint256 feeAmount,
        uint256 priceUsd1e18,
        uint256 timestamp,
        bool viaPrice,
        bool viaTime
    );

    event PriceFeedsUsed(
        uint256 chosenPriceUsd1e18,
        bool viaPrice,
        bool viaTime,
        bool primaryValid,
        uint256 primaryPriceUsd1e18,
        uint256 primaryQuoteRes,
        bool backupValid,
        uint256 backupPriceUsd1e18,
        uint256 backupQuoteRes,
        bool usedPrimary,
        bool usedBackup
    );

    constructor(
        address _owner,
        address _lockToken,
        address _primaryQuoteToken,
        address _backupQuoteToken,
        address _primaryPair,
        address _backupPair,
        uint256 _priceThresholdUsd1e18,
        uint256 _unlockTime,
        bool _isNative,
        uint8 _lockDecimals,
        uint8 _primaryQuoteDecimals,
        uint8 _backupQuoteDecimals
    ) {
        require(_owner != address(0), "owner=0");
        require(_priceThresholdUsd1e18 > 0, "threshold=0");
        require(_unlockTime > block.timestamp, "unlockTime in past");
        require(_primaryPair != address(0), "primaryPair=0");

        owner = _owner;
        lockToken = _lockToken;
        primaryQuoteToken = _primaryQuoteToken;
        backupQuoteToken = _backupQuoteToken;
        primaryPair = IUniswapV2PairGeneric(_primaryPair);
        backupPair = IUniswapV2PairGeneric(_backupPair);
        isNative = _isNative;

        lockTokenDecimals = _lockDecimals;
        primaryQuoteDecimals = _primaryQuoteDecimals;
        backupQuoteDecimals = _backupQuoteDecimals;

        priceThreshold = _priceThresholdUsd1e18;
        unlockTime = _unlockTime;
        startTime = block.timestamp;

        // PRIMARY orientation
        {
            IUniswapV2PairGeneric p = IUniswapV2PairGeneric(_primaryPair);
            address t0 = p.token0();
            address t1 = p.token1();

            require(
                (t0 == _lockToken && t1 == _primaryQuoteToken) ||
                (t0 == _primaryQuoteToken && t1 == _lockToken),
                "PRIMARY mismatch"
            );

            primaryLockTokenIsToken0 = (t0 == _lockToken);
        }

        // BACKUP orientation
        bool _backupIs0 = false;
        if (_backupPair != address(0)) {
            IUniswapV2PairGeneric pB = IUniswapV2PairGeneric(_backupPair);
            address b0 = pB.token0();
            address b1 = pB.token1();

            require(
                (b0 == _lockToken && b1 == _backupQuoteToken) ||
                (b0 == _backupQuoteToken && b1 == _lockToken),
                "BACKUP mismatch"
            );

            _backupIs0 = (b0 == _lockToken);
        }
        backupLockTokenIsToken0 = _backupIs0;
    }

    receive() external payable {}

    // --------------------------------------------------------------
    // INTERNAL FEED LOGIC
    // --------------------------------------------------------------
    struct FeedInfo {
        bool valid;
        uint256 priceUsd1e18;
        uint256 quoteRes;
    }

    struct EvalResult {
        uint256 chosenPriceUsd1e18;
        bool valid;
        FeedInfo primary;
        FeedInfo backup;
        bool usedPrimary;
        bool usedBackup;
    }

    function _toUsdPrice(
        uint256 rawPrice1e18,
        uint8 _lockDecimals,
        uint8 _quoteDecimals
    ) internal pure returns (uint256) {
        if (rawPrice1e18 == 0) return 0;

        if (_lockDecimals == _quoteDecimals) {
            return rawPrice1e18;
        } else if (_lockDecimals > _quoteDecimals) {
            uint256 diff = uint256(_lockDecimals - _quoteDecimals);
            return rawPrice1e18 * (10 ** diff);
        } else {
            uint256 diff = uint256(_quoteDecimals - _lockDecimals);
            return rawPrice1e18 / (10 ** diff);
        }
    }

    function _tryFeed(
        IUniswapV2PairGeneric pair,
        bool lockIsToken0,
        uint8 quoteDecimals
    ) internal view returns (FeedInfo memory fi) {
        if (address(pair) == address(0)) return fi;

        try pair.getReserves() returns (uint112 r0, uint112 r1, uint32) {
            if (r0 == 0 || r1 == 0) return fi;

            uint256 lockRes;
            uint256 quoteRes;
            if (lockIsToken0) {
                lockRes  = uint256(r0);
                quoteRes = uint256(r1);
            } else {
                lockRes  = uint256(r1);
                quoteRes = uint256(r0);
            }

            if (lockRes == 0) return fi;

            uint256 rawPrice1e18 = (quoteRes * 1e18) / lockRes;
            if (rawPrice1e18 == 0) return fi;

            uint256 usdPrice1e18 = _toUsdPrice(
                rawPrice1e18,
                lockTokenDecimals,
                quoteDecimals
            );
            if (usdPrice1e18 == 0) return fi;

            fi.valid = true;
            fi.priceUsd1e18 = usdPrice1e18;
            fi.quoteRes = quoteRes;
        } catch {
            // ignore
        }

        return fi;
    }

    function _normalizeQuoteRes(
        uint256 quoteRes,
        uint8 decimals
    ) internal pure returns (uint256) {
        if (decimals == 18) return quoteRes;
        if (decimals < 18) {
            return quoteRes * (10 ** uint256(18 - decimals));
        }
        return quoteRes / (10 ** uint256(decimals - 18));
    }

    function _evaluate() internal view returns (EvalResult memory er) {
        er.primary = _tryFeed(
            primaryPair,
            primaryLockTokenIsToken0,
            primaryQuoteDecimals
        );
        er.backup = _tryFeed(
            backupPair,
            backupLockTokenIsToken0,
            backupQuoteDecimals
        );

        bool ok1 = er.primary.valid;
        bool ok2 = er.backup.valid;

        if (!ok1 && !ok2) return er;

        if (ok1 && !ok2) {
            er.valid = true;
            er.chosenPriceUsd1e18 = er.primary.priceUsd1e18;
            er.usedPrimary = true;
            return er;
        }

        if (!ok1 && ok2) {
            er.valid = true;
            er.chosenPriceUsd1e18 = er.backup.priceUsd1e18;
            er.usedBackup = true;
            return er;
        }

        // both valid — choose USD-normalized liquidity
        uint256 primNorm = _normalizeQuoteRes(
            er.primary.quoteRes,
            primaryQuoteDecimals
        );
        uint256 backNorm = _normalizeQuoteRes(
            er.backup.quoteRes,
            backupQuoteDecimals
        );

        if (primNorm > backNorm) {
            er.valid = true;
            er.chosenPriceUsd1e18 = er.primary.priceUsd1e18;
            er.usedPrimary = true;
            return er;
        } else if (backNorm > primNorm) {
            er.valid = true;
            er.chosenPriceUsd1e18 = er.backup.priceUsd1e18;
            er.usedBackup = true;
            return er;
        }

        // equal liquidity → choose higher USD price
        if (er.primary.priceUsd1e18 >= er.backup.priceUsd1e18) {
            er.valid = true;
            er.chosenPriceUsd1e18 = er.primary.priceUsd1e18;
            er.usedPrimary = true;
        } else {
            er.valid = true;
            er.chosenPriceUsd1e18 = er.backup.priceUsd1e18;
            er.usedBackup = true;
        }
    }

    // --------------------------------------------------------------
    // PUBLIC VIEWS
    // --------------------------------------------------------------
    function priceDetail()
        external
        view
        returns (
            uint256 chosenPriceUsd1e18,
            bool primaryValid,
            uint256 primaryPx,
            uint256 primaryQuoteRes,
            bool backupValid,
            uint256 backupPx,
            uint256 backupQuoteRes,
            bool usedPrimary,
            bool usedBackup,
            bool valid
        )
    {
        EvalResult memory er = _evaluate();

        chosenPriceUsd1e18 = er.chosenPriceUsd1e18;
        primaryValid        = er.primary.valid;
        primaryPx           = er.primary.priceUsd1e18;
        primaryQuoteRes     = er.primary.quoteRes;
        backupValid         = er.backup.valid;
        backupPx            = er.backup.priceUsd1e18;
        backupQuoteRes      = er.backup.quoteRes;
        usedPrimary         = er.usedPrimary;
        usedBackup          = er.usedBackup;
        valid               = er.valid;
    }

    function currentPrice1e18() public view returns (uint256) {
        EvalResult memory er = _evaluate();
        require(er.valid, "No valid price");
        return er.chosenPriceUsd1e18;
    }

    function priceConditionMet() public view returns (bool) {
        EvalResult memory er = _evaluate();
        return er.valid && er.chosenPriceUsd1e18 >= priceThreshold;
    }

    function timeConditionMet() public view returns (bool) {
        return block.timestamp >= unlockTime;
    }

    function canWithdraw() public view returns (bool) {
        if (withdrawn) return false;
        if (block.timestamp >= unlockTime) return true;

        EvalResult memory er = _evaluate();
        return er.valid && er.chosenPriceUsd1e18 >= priceThreshold;
    }

    function secondsUntilTimeUnlock() external view returns (uint256) {
        if (block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
    }
    // --------------------------------------------------------------
    // FEE & TRANSFER HELPERS
    //
    // NOTE TO AUDITORS / GOOD-FAITH READERS:
    // These helpers are intentionally added to centralise fee routing
    // and fee calculation. This makes accidental misuse harder and
    // discourages trivial "copy/paste & change fee address" forks.
    //
    // There is NO hidden behaviour, NO dynamic configuration, NO owner
    // privileges. The fee is a fixed 0.5% and the recipient is fixed.
    // --------------------------------------------------------------

    function _feeRecipient() internal pure returns (address) {
        // Clean indirection. All fee routing must pass through here.
        // Forkers must understand this function (not just swap a constant).
        return FEE_RECIPIENT;
    }

    function _splitWithDivisor200(uint256 amount)
        internal
        pure
        returns (uint256 fee, uint256 payout)
    {
        // 0.5% fee = 1/200. Identical behaviour to the previous inline maths.
        uint256 f = amount / 200;
        return (f, amount - f);
    }

    function _sendNative(
        address to,
        uint256 amount,
        string memory errorMessage
    ) internal {
        // Behaviour identical to original: skip zero-value sends.
        if (amount == 0) return;

        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, errorMessage);
    }

    function _sendToken(
        address token,
        address to,
        uint256 amount,
        string memory errorMessage
    ) internal {
        if (amount == 0) return;

        require(IERC20Generic(token).transfer(to, amount), errorMessage);
    }

    // --------------------------------------------------------------
    // WITHDRAW
    // --------------------------------------------------------------
    function withdraw() external {
        require(msg.sender == owner, "not owner");
        require(!withdrawn, "already withdrawn");

        bool viaTime = block.timestamp >= unlockTime;
        bool viaPrice = false;

        EvalResult memory er;

        if (!viaTime) {
            er = _evaluate();
            if (er.valid && er.chosenPriceUsd1e18 >= priceThreshold) {
                viaPrice = true;
            }
        } else {
            er = _evaluate();
        }

        require(viaPrice || viaTime, "conditions not met");
        withdrawn = true;

        uint256 bal;
        uint256 fee;
        uint256 payout;

        if (isNative) {
            bal = address(this).balance;
            require(bal > 0, "no PLS");

            (fee, payout) = _splitWithDivisor200(bal);

            // 0.5% fee → fee recipient
            _sendNative(_feeRecipient(), fee, "fee fail");

            // rest → owner
            _sendNative(owner, payout, "send fail");

        } else {
            bal = IERC20Generic(lockToken).balanceOf(address(this));
            require(bal > 0, "no tokens");

            (fee, payout) = _splitWithDivisor200(bal);

            _sendToken(lockToken, _feeRecipient(), fee, "fee fail");
            _sendToken(lockToken, owner, payout, "send fail");
        }


        emit PriceFeedsUsed(
            er.chosenPriceUsd1e18,
            viaPrice,
            viaTime,
            er.primary.valid,
            er.primary.priceUsd1e18,
            er.primary.quoteRes,
            er.backup.valid,
            er.backup.priceUsd1e18,
            er.backup.quoteRes,
            er.usedPrimary,
            er.usedBackup
        );

        emit Withdrawn(
            owner,
            bal,
            fee,
            er.chosenPriceUsd1e18,
            block.timestamp,
            viaPrice,
            viaTime
        );
        
    }
        // --------------------------------------------------------------
        // RESCUE FUNCTIONS 
        //
        // These allow the owner to retrieve:
        //  - tokens accidentally sent AFTER the vault is withdrawn
        //  - random airdrops
        //
        // They DO NOT allow bypassing the original time/price lock,
        // because rescuing the lockToken or native PLS is ONLY allowed
        // after `withdrawn == true`.
        // --------------------------------------------------------------

        function rescue(address token) external {
            require(msg.sender == owner, "not owner");

            // Prevent bypassing the original lock:
            //
            // NON-NATIVE vaults (HEX / pDAI):
            //     lockToken *is* the locked asset → must NOT be rescuable early.
            //
            // NATIVE PLS vaults:
            //     locked asset = native PLS (address(this).balance)
            //     lockToken = WPLS (only used for price feed)
            //     WPLS is *not* the locked asset and CAN be rescued early.
            //
            if (!isNative && token == lockToken) {
                require(withdrawn, "use withdraw");
            }

            uint256 bal = IERC20Generic(token).balanceOf(address(this));
            require(bal > 0, "no balance");

            require(IERC20Generic(token).transfer(owner, bal), "rescue fail");
        }


        function rescueNative() external {
            require(msg.sender == owner, "not owner");

            // Prevent bypassing the original lock:
            //
            // NATIVE PLS vaults:
            //     native balance IS the locked asset → must NOT be rescuable early.
            //
            // NON-NATIVE vaults (HEX / pDAI):
            //     PLS is foreign and may be rescued at any time.
            //
            if (isNative) {
                require(withdrawn, "use withdraw");
            }

            uint256 bal = address(this).balance;
            require(bal > 0, "no PLS");

            (bool s, ) = payable(owner).call{value: bal}("");
            require(s, "rescue PLS fail");
        }

}
