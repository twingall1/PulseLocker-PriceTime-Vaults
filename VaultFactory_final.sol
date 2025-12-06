// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GenericPriceTimeVault.sol";

contract PulseLocker_VaultFactory {
    bytes32 public constant ASSET_PLS  = keccak256("PLS");
    bytes32 public constant ASSET_PDAI = keccak256("PDAI");
    bytes32 public constant ASSET_HEX  = keccak256("HEX");

    // Core tokens (PulseChain)
    address public constant DAI =
        0xefD766cCb38EaF1dfd701853BFCe31359239F305;
    address public constant WPLS =
        0xA1077a294dDE1B09bB078844df40758a5D0f9a27;
    address public constant PDAI =
        0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address public constant HEX_TOKEN =
        0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39;

    // Correct USDC variant (PulseX one; decimals() reverts; do NOT call decimals()).
    address public constant USDC =
        0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07;

    // Decimals (hardcoded invariants)
    uint8 public constant DAI_DEC   = 18;
    uint8 public constant USDC_DEC  = 6;
    uint8 public constant PLS_DEC   = 18;
    uint8 public constant PDAI_DEC  = 18;
    uint8 public constant HEX_DEC   = 8;

    // PulseX pairs
    address public constant PLS_DAI_V1_PAIR =
        0xE56043671df55dE5CDf8459710433C10324DE0aE; // WPLS/DAI V1

    address public constant PLS_DAI_V2_PAIR =
        0x146E1f1e060e5b5016Db0D118D2C5a11A240ae32; // WPLS/DAI V2

    address public constant PDAI_DAI_V2_PAIR =
        0xfC64556FAA683e6087F425819C7Ca3C558e13aC1; // pDAI/DAI V2

    address public constant PDAI_DAI_V1_PAIR =
        0x1D2be6eFf95Ac5C380a8D6a6143b6a97dd9D8712; // pDAI/DAI V1

    address public constant HEX_DAI_V1_PAIR =
        0x6F1747370B1CAcb911ad6D4477b718633DB328c8; // HEX/DAI V1

    address public constant USDC_WPLS_V1_PAIR =
        0x6753560538ECa67617A9Ce605178F788bE7E524E; // USDC/WPLS V1 (not used for price, but kept if ever needed)

    address public constant USDC_HEX_V2_PAIR =
        0xC475332e92561CD58f278E4e2eD76c17D5b50f05; // USDC/HEX V2

    event VaultCreated(
        address indexed owner,
        address vault,
        bytes32 assetKey,
        uint256 priceThresholdUsd1e18,
        uint256 unlockTime
    );

    struct CFG {
        bool    enabled;
        bool    isNative;
        address lock;
        uint8   lockDec;
        address pQuote;
        address pPair;
        uint8   pDec;
        address bQuote;
        address bPair;
        uint8   bDec;
    }

    // ⭐ Registry of vaults per owner 
    mapping(address => address[]) private _vaultsByOwner;

    function getVaultsByOwner(address owner)
        external
        view
        returns (address[] memory)
    {
        return _vaultsByOwner[owner];
    }

    function get(bytes32 key) public pure returns (CFG memory c) {
        if (key == ASSET_PLS) {
            return CFG(
                true,
                true,
                WPLS,
                PLS_DEC,
                DAI,
                PLS_DAI_V1_PAIR,
                DAI_DEC,
                DAI,
                PLS_DAI_V2_PAIR,
                DAI_DEC
            );
        }
        if (key == ASSET_PDAI) {
            return CFG(
                true,
                false,
                PDAI,
                PDAI_DEC,
                DAI,
                PDAI_DAI_V2_PAIR,
                DAI_DEC,
                DAI,
                PDAI_DAI_V1_PAIR,
                DAI_DEC
            );
        }
        if (key == ASSET_HEX) {
            return CFG(
                true,
                false,
                HEX_TOKEN,
                HEX_DEC,
                USDC,
                USDC_HEX_V2_PAIR,
                USDC_DEC,
                DAI,
                HEX_DAI_V1_PAIR,
                DAI_DEC
            );
        }

        return CFG(false, false, address(0), 0, address(0), address(0), 0, address(0), address(0), 0);
    }

    function createVault(
        bytes32 assetKey,
        uint256 priceThresholdUsd1e18,
        uint256 unlockTime
    ) external returns (address v) {
        require(priceThresholdUsd1e18 > 0, "threshold=0");
        require(unlockTime > block.timestamp, "time");

        CFG memory c = get(assetKey);
        require(c.enabled, "unsupported");

        v = address(
            new GenericPriceTimeVault(
                msg.sender,
                c.lock,
                c.pQuote,
                c.bQuote,
                c.pPair,
                c.bPair,
                priceThresholdUsd1e18,
                unlockTime,
                c.isNative,
                c.lockDec,
                c.pDec,
                c.bDec
            )
        );

        // record in registry
        _vaultsByOwner[msg.sender].push(v);

        emit VaultCreated(msg.sender, v, assetKey, priceThresholdUsd1e18, unlockTime);
    }
}
