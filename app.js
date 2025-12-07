// ================================
// app.js — V9.1, improved wide 5-column vault layout
// with no flashing / disappearing vault cards
// ================================

console.log("Generic vault app.js loaded (V9.1 wide cards, no flash).");

if (!window.ethers) {
  alert("Ethers failed to load.");
  throw new Error("Ethers missing");
}
const ethersLib = window.ethers;

// -------------------------------
// Helpers
// -------------------------------
function formatLockPrice(value) {
  if (!isFinite(value) || value === 0) return "0.0000";
  let s = Number(value).toPrecision(4);
  if (s.includes("e") || s.includes("E")) {
    const n = Number(s);
    let fixed = n.toFixed(8);
    fixed = fixed.replace(/0+$/, "").replace(/\.$/, "");
    return fixed;
  } else {
    return s;
  }
}

function formatReserveK(value) {
  if (!isFinite(value) || value === 0) return "0.0000";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const inK = value / 1000;
    return formatLockPrice(inK) + "k";
  } else {
    return formatLockPrice(value);
  }
}
async function safeCall(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(false);   // false = primary provider
    } catch (err) {
      if (i === attempts - 1) {
        // try fallback provider
        return await fn(true);
      }
      await new Promise(res =>
        setTimeout(res, 80 * (i + 1))
      );
    }
  }
}

// collapse state helpers
function isCollapsed(addr) {
  const c = localStorage.getItem("vaultCollapsed-" + addr.toLowerCase());
  return c === "1";
}
function setCollapsed(addr, collapsed) {
  localStorage.setItem(
    "vaultCollapsed-" + addr.toLowerCase(),
    collapsed ? "1" : "0"
  );
}
function setGpfTitleSuffix(text) {
  const el = document.getElementById("gpfAsset");
  if (!el) return;
  el.textContent = text ? `: ${text}` : "";
}
/* =========================================================
   READ-ONLY RPC FALLBACK PROVIDER (SAFE FOR DESKTOP & MOBILE)
   ========================================================= */

const fallbackProvider = new ethersLib.providers.FallbackProvider(
  [
    new ethersLib.providers.JsonRpcProvider("https://pulsechain.publicnode.com"),
    new ethersLib.providers.JsonRpcProvider("https://rpc.pulsechain.com"),
    new ethersLib.providers.JsonRpcProvider("https://rpc-pulsechain.g4mm4.io")
  ],
  1 // 1 node success = enough
);

/* =====================================================================
   CONTRACT HELPERS (PRIMARY = WALLET PROVIDER | FALLBACK = PUBLIC RPC)
   ===================================================================== */

function getPrimaryContract(addr, abi) {
  // Uses the wallet’s RPC → Signing + network identity stays intact.
  return new ethersLib.Contract(addr, abi, provider || fallbackProvider);
}

function getFallbackContract(addr, abi) {
  // Uses public RPC cluster → very stable for reads.
  return new ethersLib.Contract(addr, abi, fallbackProvider);
}

// -------------------------------
// CONFIG
// -------------------------------
const FACTORY_ADDRESS =
  "0xfa2D526eC9B9024870147939Bcf69c01aff0531f".toLowerCase(); // :contentReference[oaicite:0]{index=0}

const ADDR = {
  DAI: "0xefD766cCb38EaF1dfd701853BFCe31359239F305".toLowerCase(),
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27".toLowerCase(),
  PDAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase(),
  HEX: "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39".toLowerCase(),
  USDC: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07".toLowerCase(),

  PLS_DAI_V1_PAIR: "0xE56043671df55dE5CDf8459710433C10324DE0aE".toLowerCase(),
  PLS_DAI_V2_PAIR: "0x146E1f1e060e5b5016Db0D118D2C5a11A240ae32".toLowerCase(),

  PDAI_DAI_V2_PAIR: "0xfC64556FAA683e6087F425819C7Ca3C558e13aC1".toLowerCase(),
  PDAI_DAI_V1_PAIR: "0x1D2be6eFf95Ac5C380a8D6a6143b6a97dd9D8712".toLowerCase(),

  HEX_DAI_V1_PAIR: "0x6F1747370B1CAcb911ad6D4477b718633DB328c8".toLowerCase(),
  USDC_HEX_V2_PAIR: "0xC475332e92561CD58f278E4e2eD76c17D5b50f05".toLowerCase()
};

const ASSETS = {
  PLS: {
    key: ethersLib.utils.keccak256(ethersLib.utils.toUtf8Bytes("PLS")),
    label: "PLS",
    isNative: true,
    lockToken: ADDR.WPLS,
    lockDecimals: 18,
    primaryQuote: ADDR.DAI,
    primaryQuoteDecimals: 18,
    primaryPair: ADDR.PLS_DAI_V1_PAIR,
    primaryFeedLabel: "PulseX V1 WPLS/DAI",
    backupQuote: ADDR.DAI,
    backupQuoteDecimals: 18,
    backupPair: ADDR.PLS_DAI_V2_PAIR,
    backupFeedLabel: "PulseX V2 WPLS/DAI"
  },
  PDAI: {
    key: ethersLib.utils.keccak256(ethersLib.utils.toUtf8Bytes("PDAI")),
    label: "pDAI",
    isNative: false,
    lockToken: ADDR.PDAI,
    lockDecimals: 18,
    primaryQuote: ADDR.DAI,
    primaryQuoteDecimals: 18,
    primaryPair: ADDR.PDAI_DAI_V2_PAIR,
    primaryFeedLabel: "PulseX V2 pDAI/DAI",
    backupQuote: ADDR.DAI,
    backupQuoteDecimals: 18,
    backupPair: ADDR.PDAI_DAI_V1_PAIR,
    backupFeedLabel: "PulseX V1 pDAI/DAI"
  },
  HEX: {
    key: ethersLib.utils.keccak256(ethersLib.utils.toUtf8Bytes("HEX")),
    label: "HEX",
    isNative: false,
    lockToken: ADDR.HEX,
    lockDecimals: 8,
    primaryQuote: ADDR.USDC,
    primaryQuoteDecimals: 6,
    primaryPair: ADDR.USDC_HEX_V2_PAIR,
    primaryFeedLabel: "PulseX V2 USDC/HEX",
    backupQuote: ADDR.DAI,
    backupQuoteDecimals: 18,
    backupPair: ADDR.HEX_DAI_V1_PAIR,
    backupFeedLabel: "PulseX V1 HEX/DAI"
  }
};

const TOKEN_ICONS = {
  PLS: "https://tokens.app.pulsex.com/images/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27.png",
  pDAI: "https://tokens.app.pulsex.com/images/tokens/0x6B175474E89094C44Da98b954EedeAC495271d0F.png",
  HEX: "https://tokens.app.pulsex.com/images/tokens/0x57fde0a71132198BBeC939B98976993d8D89D225.png"
};

Object.keys(ASSETS).forEach((code) => {
  ASSETS[code].pair = ASSETS[code].primaryPair;
});

// ABIs (unchanged) :contentReference[oaicite:1]{index=1}
const factoryAbi = [
  "event VaultCreated(address indexed owner, address vault, bytes32 assetKey, uint256 priceThresholdUsd1e18, uint256 unlockTime)",
  "function createVault(bytes32 assetKey, uint256 priceThresholdUsd1e18, uint256 unlockTime) external returns (address)",
  "function getVaultsByOwner(address owner) view returns (address[] memory)"
];

const vaultAbi = [
  "function owner() view returns (address)",
  "function lockToken() view returns (address)",
  "function primaryQuoteToken() view returns (address)",
  "function backupQuoteToken() view returns (address)",
  "function primaryPair() view returns (address)",
  "function backupPair() view returns (address)",
  "function isNative() view returns (bool)",
  "function primaryLockTokenIsToken0() view returns (bool)",
  "function backupLockTokenIsToken0() view returns (bool)",
  "function priceThreshold() view returns (uint256)",
  "function unlockTime() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function withdrawn() view returns (bool)",
  "function currentPrice1e18() view returns (uint256)",
  "function priceConditionMet() view returns (bool)",
  "function timeConditionMet() view returns (bool)",
  "function canWithdraw() view returns (bool)",
  "function secondsUntilTimeUnlock() view returns (uint256)",
  "function priceDetail() view returns (uint256,bool,uint256,uint256,bool,uint256,uint256,bool,bool,bool)",
  "function withdraw() external",
  "function rescue(address token) external",
  "function rescueNative() external"
];

const pairAbi = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) external returns (bool)"
];

// STATE + DOM
let provider, signer, userAddress;
let factoryContract;
let locks = [];
let countdownInterval;

const connectBtn = document.getElementById("connectBtn");
const walletSpan = document.getElementById("walletAddress");
const networkInfo = document.getElementById("networkInfo");
const themeToggleBtn = document.getElementById("themeToggle");

const assetSelect = document.getElementById("assetSelect");
const createForm = document.getElementById("createForm");
const targetPriceInput = document.getElementById("targetPrice");
const unlockDateInput = document.getElementById("unlockDateTime");
const createBtn = document.getElementById("createBtn");
const createStatus = document.getElementById("createStatus");

const pairAddressSpan = document.getElementById("pairAddress");
const globalPriceDiv = document.getElementById("globalPrice");
const globalPriceRaw = document.getElementById("globalPriceRaw");

const manualVaultInput = document.getElementById("manualVaultInput");
const addVaultBtn = document.getElementById("addVaultBtn");
const manualAddStatus = document.getElementById("manualAddStatus");

const locksContainer = document.getElementById("locksContainer");

// THEME TOGGLE (unchanged)
(function initTheme() {
  const saved = localStorage.getItem("vault-theme");
  if (saved === "light") {
    document.body.classList.add("light-theme");
    themeToggleBtn.textContent = "🌚 Night";
  } else {
    themeToggleBtn.textContent = "🌞 Day";
  }
})();

themeToggleBtn.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light-theme");
  localStorage.setItem("vault-theme", isLight ? "light" : "dark");
  themeToggleBtn.textContent = isLight ? "🌚 Night" : "🌞 Day";
});

// -------------------------------
// PulseChain switch helper
// -------------------------------
async function switchToPulseChain() {
  if (!window.ethereum) {
    alert("No wallet detected.");
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x171" }]
    });
  } catch (err) {
    if (err.code === 4902 || (err.message && err.message.includes("4902"))) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x171",
              chainName: "PulseChain",
              rpcUrls: ["https://rpc.pulsechain.com"],
              blockExplorerUrls: ["https://scan.pulsechain.com"],
              nativeCurrency: {
                name: "Pulse",
                symbol: "PLS",
                decimals: 18
              }
            }
          ]
        });
      } catch (addErr) {
        alert("Unable to add PulseChain: " + addErr.message);
        return;
      }
    } else {
      alert("Failed to switch: " + err.message);
      return;
    }
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    await connect();
  } catch (connErr) {
    alert("Network switched, but wallet connection failed: " + connErr.message);
  }
}

// -------------------------------
// CONNECT
// -------------------------------
async function connect() {
  try {
    if (!window.ethereum) {
      alert("No injected wallet found.");
      return;
    }

    provider = new ethersLib.providers.Web3Provider(window.ethereum, "any");
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = (await signer.getAddress()).toLowerCase();

    connectBtn.textContent = "Connected ✓";
    connectBtn.disabled = true;
    document.getElementById("disconnectBtn").style.display = "flex";

    const net = await provider.getNetwork();
    walletSpan.textContent = userAddress;
    setGpfTitleSuffix(assetSelect.value);
    
    if (net.chainId === 369) {
      networkInfo.innerHTML = `
        <span style="color:#6b7280;">Connected (chainId: 369)</span>
      `;
    } else {
      networkInfo.innerHTML = `
        <span style="color:#c62828; font-weight:700;">
          Connected (chainId: ${net.chainId}) — WRONG NETWORK
        </span>
        <button onclick="switchToPulseChain()"
                style="margin-left:8px;padding:4px 8px;
                       background:#c62828;color:#fff;border-radius:6px;">
          Switch to PulseChain
        </button>
      `;
    }

    factoryContract = new ethersLib.Contract(
      FACTORY_ADDRESS,
      factoryAbi,
      signer
    );

    await refreshGlobalPrice();

    // Initial load: show "Loading..." ONCE here, but do not clear again later
    locksContainer.textContent = "Loading...";
    await loadLocalVaults(); // fills `locks`

    renderLocks();
    updateVaultPrices(); // ensure pies/prices fill immediately

    
    // Timers
    startTimeRefresh();

    // Desktop stays at 5s; mobile (<700px wide) gets 8s to reduce RPC flakiness.
    const refreshMs = window.innerWidth < 700 ? 8000 : 5000;
    setInterval(updateVaultPrices, refreshMs);
    setInterval(refreshGlobalPrice, refreshMs);
  } catch (err) {
    alert("Connection failed: " + err.message);
    console.error(err);
  }
}
// ---------------------------------------------------
// AUTO-RECONNECT on page load (if wallet already authorized)
// ---------------------------------------------------
if (window.ethereum) {
  window.ethereum.request({ method: "eth_accounts" })
    .then((accounts) => {
      if (accounts.length > 0) {
        connect();   // User already approved this site
      }
    })
    .catch((err) => console.error("Auto-connect error:", err));
}

connectBtn.addEventListener("click", connect);

document.getElementById("disconnectBtn").addEventListener("click", () => {
  walletSpan.textContent = "";
  networkInfo.textContent = "";

  connectBtn.textContent = "Connect Wallet";
  connectBtn.disabled = false;

  document.getElementById("disconnectBtn").style.display = "none";

  userAddress = null;
  signer = null;
  provider = null;

  locks = [];
  locksContainer.textContent = "Connect wallet to load.";
  setGpfTitleSuffix(""); 
});

// ---------------------------------------------------
// AUTO UI UPDATE ON NETWORK CHANGE (NO POPUPS)
// ---------------------------------------------------
if (window.ethereum) {
  window.ethereum.on("chainChanged", async (chainIdHex) => {
    const chainId = parseInt(chainIdHex, 16);
    document.getElementById("disconnectBtn").style.display = "flex";

    if (chainId === 369) {
      networkInfo.innerHTML = `
        <span style="color:#6b7280;">Connected (chainId: 369)</span>
      `;
      connectBtn.textContent = "Connected ✓";
      connectBtn.disabled = true;
    } else {
      networkInfo.innerHTML = `
        <span style="color:#c62828; font-weight:700;">
          Connected (chainId: ${chainId}) — WRONG NETWORK
        </span>
        <button onclick="switchToPulseChain()"
                style="margin-left:8px;padding:4px 8px;
                       background:#c62828;color:#fff;border-radius:6px;">
          Switch to PulseChain
        </button>
      `;
      connectBtn.textContent = "Connected ✓";
      connectBtn.disabled = false;
    }

    refreshGlobalPrice();

    const accounts = await window.ethereum.request({
      method: "eth_accounts"
    });
    if (accounts.length) {
      walletSpan.textContent = accounts[0].toLowerCase();
    }
  });

  // Accounts changed
  window.ethereum.on("accountsChanged", async () => {
    const accounts = await window.ethereum.request({
      method: "eth_accounts"
    });
    if (!accounts.length) {
      walletSpan.textContent = "";
      connectBtn.textContent = "Connect Wallet";
      connectBtn.disabled = false;
      return;
    }
    await connect();
  });
}

// -------------------------------
// PRICE HELPERS
// -------------------------------
function computeDisplayDecimals(lockDecimals, quoteDecimals) {
  return 18 + quoteDecimals - lockDecimals;
}
function priceBNToUsdFloat(priceBN, lockDecimals, quoteDecimals) {
  const displayDecimals = computeDisplayDecimals(lockDecimals, quoteDecimals);
  return Number(ethersLib.utils.formatUnits(priceBN, displayDecimals));
}
function quoteResToUsdFloat(quoteResBN, quoteDecimals) {
  return Number(ethersLib.utils.formatUnits(quoteResBN, quoteDecimals));
}
// -------------------------------
// GLOBAL PRICE FEED
// -------------------------------
async function refreshGlobalPrice() {
  try {
    if (!provider) {
      globalPriceDiv.textContent = "Connect wallet to fetch live prices.";
      globalPriceRaw.textContent = "";
      return;
    }

    const assetCode = assetSelect.value;
    const cfg = ASSETS[assetCode];
    if (!cfg) return;



    const primaryInfo = await computePairPriceAndLiquidity(
      cfg.primaryPair,
      cfg.lockToken,
      cfg.lockDecimals,
      cfg.primaryQuote,
      cfg.primaryQuoteDecimals
    );

    let backupInfo = { ok: false };
    if (cfg.backupPair) {
      backupInfo = await computePairPriceAndLiquidity(
        cfg.backupPair,
        cfg.lockToken,
        cfg.lockDecimals,
        cfg.backupQuote,
        cfg.backupQuoteDecimals
      );
    }

    let chosenSource = "none";
    let chosenPriceFloat = null;

    if (primaryInfo.ok && !backupInfo.ok) {
      chosenSource = "primary";
      chosenPriceFloat = primaryInfo.priceFloat;
    } else if (!primaryInfo.ok && backupInfo.ok) {
      chosenSource = "backup";
      chosenPriceFloat = backupInfo.priceFloat;
    } else if (primaryInfo.ok && backupInfo.ok) {
      if (primaryInfo.quoteResFloat > backupInfo.quoteResFloat) {
        chosenSource = "primary";
        chosenPriceFloat = primaryInfo.priceFloat;
      } else if (backupInfo.quoteResFloat > primaryInfo.quoteResFloat) {
        chosenSource = "backup";
        chosenPriceFloat = backupInfo.priceFloat;
      } else {
        if (primaryInfo.priceFloat >= backupInfo.priceFloat) {
          chosenSource = "primary";
          chosenPriceFloat = primaryInfo.priceFloat;
        } else {
          chosenSource = "backup";
          chosenPriceFloat = backupInfo.priceFloat;
        }
      }
    } else {
      chosenSource = "none";
      chosenPriceFloat = null;
    }

    let html = "";

    html += `<div class="small"><b>Primary feed (1°):</b> ${cfg.primaryFeedLabel}<br>`;
    // ADD PAIR ADDRESS LINE
    html += `Pair: <span class="mono">${cfg.primaryPair}</span><br>`;
    
    // STATUS + PRICE + RESERVES
    if (!primaryInfo.ok) {
      html += `Status: <span class="status-bad">unavailable</span>`;
    } else {
      html += `Status: <span class="status-ok">ok</span><br>`;
      html += `Price: 1 ${cfg.label} ≈ $${formatLockPrice(primaryInfo.priceFloat)}, `;
      html += `USD-side reserves: $${formatReserveK(primaryInfo.quoteResFloat)}`;
    }
    html += `</div>`;


    if (cfg.backupPair) {
      html += `<div class="small" style="margin-top:8px;"><b>Backup feed (2°):</b> ${cfg.backupFeedLabel}<br>`;
      // Add backup pair address
      html += `Pair: <span class="mono">${cfg.backupPair}</span><br>`;
      
      // Status + pricing
      if (!backupInfo.ok) {
        html += `Status: <span class="status-bad">unavailable</span>`;
      } else {
        html += `Status: <span class="status-ok">ok</span><br>`;
        html += `Price: 1 ${cfg.label} ≈ $${formatLockPrice(backupInfo.priceFloat)}, `;
        html += `USD-side reserves: $${formatReserveK(backupInfo.quoteResFloat)}`;
      }
      
      html += `</div>`;

    }

    html += `<div class="small" style="margin-top:8px;">`;
    if (chosenSource === "primary") {
      html += `Effective price (logic): <b>$${formatLockPrice(
        chosenPriceFloat
      )}</b> via <b>𝟏° feed</b> (larger USD-side reserves).`;
    } else if (chosenSource === "backup") {
      html += `Effective price (logic): <b>$${formatLockPrice(
        chosenPriceFloat
      )}</b> via <b>𝟐° feed</b> (larger USD-side reserves).`;
    } else {
      html += `No valid price feeds at this moment – only time unlock will work.`;
    }
    html += `</div>`;

    globalPriceDiv.innerHTML = html;

    let rawText = "";
    if (primaryInfo.ok) {
      rawText += `𝟏° raw 1e18: ${primaryInfo.priceBN.toString()}\n`;
    } else {
      rawText += `𝟏°: unavailable\n`;
    }
    if (cfg.backupPair) {
      if (backupInfo.ok) {
        rawText += `,  𝟐° raw 1e18: ${backupInfo.priceBN.toString()}`;
      } else {
        rawText += `,  𝟐°: unavailable`;
      }
    }
    globalPriceRaw.textContent = rawText.trim();
  } catch (err) {
    globalPriceDiv.textContent = "Price error.";
    globalPriceRaw.textContent = "";
    console.error("Global price error:", err);
  }
}

assetSelect.addEventListener("change", () => {
  setGpfTitleSuffix(assetSelect.value);
  refreshGlobalPrice();
});

async function computePairPriceAndLiquidity(
  pairAddr,
  lockToken,
  lockDecimals,
  quoteToken,
  quoteDecimals
) {
  if (!pairAddr) return { ok: false };
  try {
    // using fallback rpcs
    const pair = getPrimaryContract(pairAddr, pairAbi);

    // using fallback rpcs... and More robust on mobile: retry getReserves/token0/token1 briefly if RPC hiccups
    const [r0, r1] = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(pairAddr, pairAbi).getReserves()
        : pair.getReserves()
    );
    if (r0.eq(0) || r1.eq(0)) return { ok: false };

    const token0 = (await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(pairAddr, pairAbi).token0()
        : pair.token0()
    )).toLowerCase();
    const token1 = (await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(pairAddr, pairAbi).token1()
        : pair.token1()
    )).toLowerCase();

    let lockRes, quoteRes;
    if (token0 === lockToken && token1 === quoteToken) {
      lockRes = r0;
      quoteRes = r1;
    } else if (token1 === lockToken && token0 === quoteToken) {
      lockRes = r1;
      quoteRes = r0;
    } else {
      return { ok: false };
    }

    if (lockRes.eq(0)) return { ok: false };

    const priceBN = quoteRes.mul(ethersLib.constants.WeiPerEther).div(lockRes);
    const priceFloat = priceBNToUsdFloat(priceBN, lockDecimals, quoteDecimals);
    const quoteResFloat = quoteResToUsdFloat(quoteRes, quoteDecimals);

    return {
      ok: true,
      priceBN,
      priceFloat,
      quoteResBN: quoteRes,
      quoteResFloat
    };
  } catch (err) {
    console.error("Pair price error for", pairAddr, err);
    return { ok: false };
  }
}

// -------------------------------
// LOCAL STORAGE & ORDERING
// -------------------------------
function localKey() {
  return "generic-vaults-" + (userAddress || "anon");
}
function getLocalVaults() {
  if (!userAddress) return [];
  const raw = localStorage.getItem(localKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}
function saveLocalVaultAddress(addr) {
  const list = getLocalVaults();
  const lower = addr.toLowerCase();
  if (!list.includes(lower)) {
    list.push(lower);
    localStorage.setItem(localKey(), JSON.stringify(list));
  }
}
function setLocalVaultList(list) {
  localStorage.setItem(localKey(), JSON.stringify(list));
}

// -----------------------------------------
// RESTORE ALL VAULTS (no flash, no reordering existing cards)
// -----------------------------------------
async function restoreAllVaults() {
  if (!provider || !userAddress) {
    manualAddStatus.textContent = "Connect wallet first.";
    return;
  }

  try {
    manualAddStatus.textContent = "Checking contract registry...";

    const vaultList = await factoryContract.getVaultsByOwner(userAddress);
    if (!vaultList.length) {
      manualAddStatus.textContent = "No vaults found for this wallet.";
      return;
    }

    const existingList = getLocalVaults();
    const existingSet = new Set(existingList);
    let added = 0;

    for (const v of vaultList) {
      const lower = v.toLowerCase();
      if (!existingSet.has(lower)) {
        existingList.push(lower);       // preserve user order; new ones appended
        existingSet.add(lower);
        saveLocalVaultAddress(lower);   // update storage (dedup inside)
        await softLoadSingleVault(lower); // load + render only this card
        added++;
      }
    }

    if (added === 0) {
      manualAddStatus.textContent = "All vaults already restored.";
    } else {
      manualAddStatus.textContent = `Restored ${added} vault(s).`;
    }
  } catch (err) {
    manualAddStatus.textContent = "Restore failed: " + err.message;
    console.error("Restore error:", err);
  }
}

// -------------------------------
// CREATE VAULT
// -------------------------------
createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!signer) {
    alert("Connect wallet first.");
    return;
  }

  try {
    createBtn.disabled = true;
    createStatus.textContent = "Sending...";

    const assetCode = assetSelect.value;
    const cfg = ASSETS[assetCode];
    if (!cfg) throw new Error("Unknown asset");

    const priceStr = targetPriceInput.value.trim();
    if (!priceStr) throw new Error("Enter a target price (USD per 1 token)");

    const th1e18 = ethersLib.utils.parseUnits(priceStr, 18);

    const dt = unlockDateInput.value.trim();
    const ts = Date.parse(dt);
    if (isNaN(ts)) throw new Error("Invalid datetime");
    const unlockTime = Math.floor(ts / 1000);

    if (unlockTime <= Math.floor(Date.now() / 1000)) {
      throw new Error("Unlock time must be in the future");
    }

    const tx = await factoryContract.createVault(cfg.key, th1e18, unlockTime);
    const rcpt = await tx.wait();

    let vaultAddr = null;
    for (const log of rcpt.logs) {
      try {
        const parsed = factoryContract.interface.parseLog(log);
        if (parsed.name === "VaultCreated") {
          vaultAddr = parsed.args.vault;
          break;
        }
      } catch {}
    }

    if (!vaultAddr) {
      createStatus.textContent = "Vault created but address not parsed.";
      console.warn("No VaultCreated event found in tx logs?");
    } else {
      const lower = vaultAddr.toLowerCase();
      saveLocalVaultAddress(lower);
      createStatus.textContent = `Vault created: ${lower}`;
      await softLoadSingleVault(lower); // no flash, just add one card
      updateVaultPrices();
    }
  } catch (err) {
    createStatus.textContent =
      "Error: " + (err && err.message ? err.message : String(err));
    console.error(err);
  } finally {
    createBtn.disabled = false;
  }
});

// -------------------------------
// REORDER (Up / Down) — no re-render, just DOM + memory
// -------------------------------
function moveVaultUp(addr) {
  const lower = addr.toLowerCase();
  const list = getLocalVaults();
  const idx = list.indexOf(lower);
  if (idx > 0) {
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    setLocalVaultList(list);

    const idxLock = locks.findIndex((l) => l.address === lower);
    if (idxLock > 0) {
      [locks[idxLock - 1], locks[idxLock]] = [
        locks[idxLock],
        locks[idxLock - 1]
      ];
    }

    renderLocks();
    updateVaultPrices();
  }
}

function moveVaultDown(addr) {
  const lower = addr.toLowerCase();
  const list = getLocalVaults();
  const idx = list.indexOf(lower);
  if (idx >= 0 && idx < list.length - 1) {
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    setLocalVaultList(list);

    const idxLock = locks.findIndex((l) => l.address === lower);
    if (idxLock >= 0 && idxLock < locks.length - 1) {
      [locks[idxLock], locks[idxLock + 1]] = [
        locks[idxLock + 1],
        locks[idxLock]
      ];
    }

    renderLocks();
    updateVaultPrices();
  }
}

// -------------------------------
// CORE VAULT LOADERS
// -------------------------------
function detectAssetLabel(lockTokenAddr, isNative) {
  if (isNative) return "PLS";
  const addr = lockTokenAddr.toLowerCase();
  if (addr === ADDR.PDAI) return "pDAI";
  if (addr === ADDR.HEX) return "HEX";
  return "Unknown";
}

async function loadOneVault(addr) {
  try {
    const vault = getPrimaryContract(addr, vaultAbi);

    // Sequential + safeCall: more robust on flaky mobile RPC;
    // only runs when initially loading a vault (not every 5s).
    const owner = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).owner()
        : vault.owner()
    );
    
    const lockToken = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).lockToken()
        : vault.lockToken()
    );
    
    const isNative = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).isNative()
        : vault.isNative()
    );
    
    const threshold = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).priceThreshold()
        : vault.priceThreshold()
    );
    
    const unlockTime = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).unlockTime()
        : vault.unlockTime()
    );
    
    const startTime = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).startTime()
        : vault.startTime()
    );
    
    const withdrawn = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).withdrawn()
        : vault.withdrawn()
    );
    
    const primaryQuoteToken = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).primaryQuoteToken()
        : vault.primaryQuoteToken()
    );
    
    const backupQuoteToken = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).backupQuoteToken()
        : vault.backupQuoteToken()
    );
    
    const primaryPair = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).primaryPair()
        : vault.primaryPair()
    );
    
    const backupPair = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).backupPair()
        : vault.backupPair()
    );
    
    const primaryLockTokenIsToken0 = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).primaryLockTokenIsToken0()
        : vault.primaryLockTokenIsToken0()
    );
    
    const backupLockTokenIsToken0 = await safeCall(useFallback =>
      useFallback
        ? getFallbackContract(addr, vaultAbi).backupLockTokenIsToken0()
        : vault.backupLockTokenIsToken0()
    );



    const lockTokenLower = lockToken.toLowerCase();
    const assetLabel = detectAssetLabel(lockTokenLower, isNative);

    let cfgByLabel = null;
    if (assetLabel === "PLS") cfgByLabel = ASSETS.PLS;
    else if (assetLabel === "pDAI") cfgByLabel = ASSETS.PDAI;
    else if (assetLabel === "HEX") cfgByLabel = ASSETS.HEX;

    const lockDecimals = cfgByLabel ? cfgByLabel.lockDecimals : 18;
    const primaryQuoteDecimals = cfgByLabel
      ? cfgByLabel.primaryQuoteDecimals
      : 18;
    const backupQuoteDecimals = cfgByLabel
      ? cfgByLabel.backupQuoteDecimals
      : 18;

    let balanceBN;
    if (isNative) {
      balanceBN = await safeCall(() => provider.getBalance(addr));
    } else {
      const erc20 = new ethersLib.Contract(lockToken, erc20Abi, provider);
      balanceBN = await safeCall(() => erc20.balanceOf(addr));
    }

    let chosenPriceBN = ethersLib.constants.Zero;
    let primaryValid = false;
    let primaryPriceBN = ethersLib.constants.Zero;
    let primaryQuoteResBN = ethersLib.constants.Zero;
    let backupValid = false;
    let backupPriceBN = ethersLib.constants.Zero;
    let backupQuoteResBN = ethersLib.constants.Zero;
    let usedPrimary = false;
    let usedBackup = false;
    let priceValid = false;

    try {
      const detail = await safeCall(useFallback =>
        useFallback
          ? getFallbackContract(addr, vaultAbi).priceDetail()
          : vault.priceDetail()
      );
      chosenPriceBN = detail[0];
      primaryValid = detail[1];
      primaryPriceBN = detail[2];
      primaryQuoteResBN = detail[3];
      backupValid = detail[4];
      backupPriceBN = detail[5];
      backupQuoteResBN = detail[6];
      usedPrimary = detail[7];
      usedBackup = detail[8];
      priceValid = detail[9];
    } catch {
      try {
        chosenPriceBN = await vault.currentPrice1e18();
        priceValid = true;
      } catch {
        priceValid = false;
      }
    }

    let canWithdraw = false;
    try {
      canWithdraw = await vault.canWithdraw();
    } catch {
      canWithdraw = false;
    }

    return {
      address: addr.toLowerCase(),
      owner: owner.toLowerCase(), 
      assetLabel,
      lockToken: lockTokenLower,
      primaryQuoteToken: primaryQuoteToken.toLowerCase(),
      backupQuoteToken: backupQuoteToken.toLowerCase(),
      primaryPair: primaryPair.toLowerCase(),
      backupPair: backupPair.toLowerCase(),
      primaryLockTokenIsToken0,
      backupLockTokenIsToken0,
      isNative,
      threshold,
      unlockTime: unlockTime.toNumber(),
      startTime: startTime.toNumber(),
      withdrawn,
      balanceBN,
      chosenPriceBN,
      primaryValid,
      primaryPriceBN,
      primaryQuoteResBN,
      backupValid,
      backupPriceBN,
      backupQuoteResBN,
      usedPrimary,
      usedBackup,
      priceValid,
      lockDecimals,
      primaryQuoteDecimals,
      backupQuoteDecimals,
      canWithdraw
    };
  } catch (err) {
    console.error("Vault load error:", addr, err);
    return { address: addr.toLowerCase(), error: true };
  }
}

// Load *all* from local storage – ONLY called on initial connect
async function loadLocalVaults() {
  const list = getLocalVaults();

  if (!list.length) {
    locks = [];
    locksContainer.textContent = "No locks found.";
    return;
  }

  // 🚀 PARALLEL LOAD (Option B)
  const results = await Promise.all(
    list.map(addr => loadOneVault(addr))
  );

  locks = results;
}


// Insert a newly-rendered card DOM node at the correct position
function insertVaultCardInOrder(addr, cardHtml) {
  const list = getLocalVaults();
  const lower = addr.toLowerCase();
  const idx = list.indexOf(lower);

  const temp = document.createElement("div");
  temp.innerHTML = cardHtml.trim();
  const newCard = temp.firstElementChild;
  newCard.dataset.addr = lower;

  const existingCards = Array.from(
    locksContainer.querySelectorAll(".vault-card")
  );
  if (!existingCards.length || idx === -1 || idx >= existingCards.length) {
    locksContainer.appendChild(newCard);
    return;
  }

  const anchorCard = existingCards[idx];
  locksContainer.insertBefore(newCard, anchorCard);
}

// Soft-load a single vault (no full reload, no flash)
async function softLoadSingleVault(addr) {
  const lock = await loadOneVault(addr);
  if (!lock) return;

  const lower = lock.address;
  const existingIdx = locks.findIndex((l) => l.address === lower);
  if (existingIdx >= 0) {
    locks[existingIdx] = lock;
  } else {
    locks.push(lock);
  }

  const html = renderSingleVault(lock);
  const existingCard = locksContainer.querySelector(
    `.vault-card[data-addr="${lower}"]`
  );
  if (existingCard) {
    const temp = document.createElement("div");
    temp.innerHTML = html.trim();
    existingCard.replaceWith(temp.firstElementChild);
  } else {
    insertVaultCardInOrder(lower, html);
  }

  attachPieHandlers();
  updateVaultPrices();
}

// Refresh one vault after withdraw / rescue (no flash)
async function refreshSingleVault(addr) {
  const updated = await loadOneVault(addr);
  if (!updated) return;

  const lower = updated.address;
  const idx = locks.findIndex((l) => l.address === lower);
  if (idx >= 0) {
    locks[idx] = updated;
  } else {
    locks.push(updated);
  }

  const card = document.querySelector(`.vault-card[data-addr="${lower}"]`);
  const html = renderSingleVault(updated);
  const temp = document.createElement("div");
  temp.innerHTML = html.trim();

  if (card) {
    card.replaceWith(temp.firstElementChild);
  } else {
    insertVaultCardInOrder(lower, html);
  }

  attachPieHandlers();
  updateVaultPrices();
}
// -------------------------------
// RENDERING
// -------------------------------
function renderSingleVault(lock) {
  if (lock.error) {
    return `
      <div class="card vault-card" data-addr="${lock.address}">
        <div class="small">Error loading vault at ${lock.address}</div>
        <button onclick="removeVault('${lock.address}')"
                style="margin-top:10px;background:#b91c1c;">
          Remove
        </button>
      </div>
    `;
  }

  const assetLabel = lock.assetLabel;
  const addrFull = lock.address;
  const isOwner = (lock.owner === userAddress);
  const collapsedCls = isCollapsed(addrFull) ? "collapsed" : "";

  const thresholdFloat = parseFloat(
    ethersLib.utils.formatUnits(lock.threshold, 18)
  );
  const currentPriceFloat =
    lock.priceValid && lock.chosenPriceBN.gt(0)
      ? parseFloat(ethersLib.utils.formatUnits(lock.chosenPriceBN, 18))
      : 0;

  const balanceDisplayDecimals = assetLabel === "HEX" ? 8 : 18;
  const balanceFloat = parseFloat(
    ethersLib.utils.formatUnits(lock.balanceBN, balanceDisplayDecimals)
  );

  const withdrawnTag = lock.withdrawn;
  const hasBalance = !lock.balanceBN.isZero();
  const canWithdraw = lock.canWithdraw && !withdrawnTag;
  const showRescue = withdrawnTag && hasBalance;

  const status = withdrawnTag
    ? '<span class="tag status-warn">✖ WITHDRAWN ✖</span>'
    : canWithdraw
    ? '<span class="tag status-ok">✔ UNLOCKED ✔</span>'
    : '<span class="tag status-bad">🔒 LOCKED 🔒</span>';

  const nowTs = Math.floor(Date.now() / 1000);
  let timeGoalPct = 0;
  let timeLabel = "";

  if (lock.startTime && lock.unlockTime && lock.unlockTime > lock.startTime) {
    const total = lock.unlockTime - lock.startTime;
    const done = Math.min(nowTs, lock.unlockTime) - lock.startTime;
    timeGoalPct = Math.max(0, Math.min(100, (done / total) * 100));
    const secsLeft = Math.max(0, lock.unlockTime - nowTs);
    timeLabel = formatCountdownNumber(secsLeft) + " remaining";
  } else {
    timeGoalPct = 0;
    timeLabel = "N/A";
  }
  const timeBarStyle = `width:${timeGoalPct.toFixed(1)}%;`;

  const thresholdPct =
    thresholdFloat > 0 && currentPriceFloat > 0
      ? Math.min(100, Math.max(0, (currentPriceFloat / thresholdFloat) * 100))
      : 0;

  const primaryPriceFloat = lock.primaryValid
    ? parseFloat(ethersLib.utils.formatUnits(lock.primaryPriceBN, 18))
    : 0;

  const backupPriceFloat = lock.backupValid
    ? parseFloat(ethersLib.utils.formatUnits(lock.backupPriceBN, 18))
    : 0;

  const primaryResFloat = lock.primaryQuoteResBN.gt(0)
    ? quoteResToUsdFloat(lock.primaryQuoteResBN, lock.primaryQuoteDecimals)
    : 0;

  const backupResFloat = lock.backupQuoteResBN.gt(0)
    ? quoteResToUsdFloat(lock.backupQuoteResBN, lock.backupQuoteDecimals)
    : 0;

  const effectiveLine = lock.usedPrimary
    ? `Effective price= $${formatLockPrice(
        currentPriceFloat
      )} via 𝟏° feed`
    : lock.usedBackup
    ? `Effective price= $${formatLockPrice(
        currentPriceFloat
      )} via 𝟐° feed`
    : `Effective price= feeds unavailable — using time unlock only`;

  return `
    <div class="card vault-card ${collapsedCls}" data-addr="${addrFull}">
      <div class="vault-header">
        <span class="vault-asset-label label-${assetLabel}">
          ${
            TOKEN_ICONS[assetLabel]
              ? `<img src="${TOKEN_ICONS[assetLabel]}" class="token-mini">`
              : ""
          }
          ${assetLabel} VAULT
        </span>

        ${status}

        <input class="mono"
               value="${addrFull}"
               readonly
               style="
                 background:var(--input-bg);
                 color:#a5b4fc;
                 border:1px solid var(--input-border);
                 padding:3px 4px;
                 border-radius:6px;
                 width: 360px;
                 max-width:360px;
                 overflow:hidden;
                 text-overflow:ellipsis;
                 white-space:nowrap;
               " />

        <div class="copy-icon-btn" onclick="copyAddr('${addrFull}', event)">
          <svg viewBox="0 0 24 24">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </div>

        <button class="minmax-btn"
                onclick="toggleVault('${addrFull}')">
          ${isCollapsed(addrFull) ? "▼ Max" : "▲ Min"}
        </button>


        <div class="reorder-buttons">
          ${
            locks.findIndex((l) => l.address === addrFull) > 0
              ? `<div class="reorder-up" onclick="moveVaultUp('${addrFull}')">▲</div>`
              : ``
          }
          ${
            locks.findIndex((l) => l.address === addrFull) <
            locks.length - 1
              ? `<div class="reorder-down" onclick="moveVaultDown('${addrFull}')">▼</div>`
              : ``
          }
        </div>
      </div>

      <div class="vault-body">
        <div class="vault-col-main">
          <div class="col1-line">
            target&nbsp;&nbsp;&nbsp;💲:
            &nbsp;<span class="col1-value-bold">1 ${assetLabel} ≥ $${formatLockPrice(thresholdFloat)}</span>
          </div>
        
          <div class="col1-line">
            current&nbsp;💲:
            &nbsp;<span class="col1-value-bold">$${formatLockPrice(currentPriceFloat)}</span>
          </div>
        
          <div class="col1-line">
            time&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;🔓:
            &nbsp;<span class="col1-value-bold">${formatTimestamp(lock.unlockTime)}</span>
          </div>
        
          <div class="col1-line">
            locked&nbsp;🪙:
            &nbsp;<span class="col1-value-bold">${balanceFloat.toFixed(4)} ${assetLabel}</span>
          </div>
        </div>


        <div class="vault-col-buttons">
          ${
            isOwner
              ? (
                  !withdrawnTag
                    ? `<button data-role="withdraw" onclick="withdrawVault('${addrFull}')" ${
                        canWithdraw ? "" : "disabled"
                      }>Withdraw</button>`
                    : ``
                )
              : `<div class="view-only-label">~View Only~</div>`
          }
        
          ${
            isOwner
              ? (
                  showRescue
                    ? `<button data-role="rescue" onclick="rescueVault('${addrFull}')"
                        style="background:#1d4ed8;color:white;">Rescue</button>`
                    : `<button data-role="rescue" style="display:none;background:#1d4ed8;color:white;"
                        onclick="rescueVault('${addrFull}')">Rescue</button>`
                )
              : ``
          }
        
          <button data-role="remove" onclick="removeVault('${addrFull}')"
                  style="background:#b91c1c;">
            Remove
          </button>
        </div>

        <!-- NEW FOREIGN-RESCUE COLUMN -->
        <div class="vault-col-rescue-foreign"></div>
        
        <div class="vault-col-pie">
          <div class="small" style="text-align:center;">Price goal</div>
          <div class="pie-wrapper">
            <div class="price-goal-pie"
                 style="background:conic-gradient(#22c55e ${thresholdPct}%, #1f2937 ${thresholdPct}%);">
            </div>
            <div class="pie-tooltip">${thresholdPct.toFixed(2)}%</div>
          </div>
        </div>

        <div class="vault-col-time">
          <div class="small">Time progress</div>
          <div class="time-progress-bar-bg">
            <div class="time-progress-bar-fill" style="${timeBarStyle}"></div>
          </div>
          <div class="small">${timeLabel}</div>
        </div>

        <div class="vault-col-feeds">
          <div>
            <div><b>1°</b> : $${formatLockPrice(
              primaryPriceFloat
            )}, $reserves ≈ ${formatReserveK(primaryResFloat)}</div>
            <div><b>2°</b> : $${formatLockPrice(
              backupPriceFloat
            )}, $reserves ≈ ${formatReserveK(backupResFloat)}</div>
            <div>${effectiveLine}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render *all* vaults (used only once on initial load or after reorder)
function renderLocks() {
  if (!locks.length) {
    locksContainer.textContent = "No locks found.";
    return;
  }

  const html = locks.map((l) => renderSingleVault(l)).join("");
  locksContainer.innerHTML = html;

  attachPieHandlers();
}

// Attach hover tooltips to pies
function attachPieHandlers() {
  const cards = locksContainer.querySelectorAll(".vault-card");
  cards.forEach((card) => {
    const pieWrapper = card.querySelector(".pie-wrapper");
    const tooltip = card.querySelector(".pie-tooltip");
    if (pieWrapper && tooltip) {
      pieWrapper.addEventListener("mouseenter", () => {
        tooltip.style.opacity = "1";
      });
      pieWrapper.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
      });
    }
  });
}

// -------------------------------
// TIME REFRESH (1s)
// -------------------------------
function startTimeRefresh() {
  setInterval(() => {
    if (!locks.length) return;
    const nowTs = Math.floor(Date.now() / 1000);

    for (const lock of locks) {
      if (!lock.startTime || !lock.unlockTime) continue;
      const total = lock.unlockTime - lock.startTime;
      if (total <= 0) continue;

      const done = Math.min(nowTs, lock.unlockTime) - lock.startTime;
      const pct = Math.max(0, Math.min(100, (done / total) * 100));
      const secsLeft = Math.max(0, lock.unlockTime - nowTs);

      const card = document.querySelector(
        `.vault-card[data-addr="${lock.address}"]`
      );
      if (!card) continue;

      const barFill = card.querySelector(".time-progress-bar-fill");
      const labelEl = card.querySelector(".vault-col-time .small:last-child");

      if (barFill) barFill.style.width = `${pct.toFixed(1)}%`;
      if (labelEl) labelEl.textContent = formatCountdownNumber(secsLeft) + " remaining";
    }
  }, 1000);
}

// -------------------------------
// NO-FLASH PRICE/BALANCE/RESCUE UPDATE (5s)
// -------------------------------
async function updateVaultPrices() {
  if (!locks.length) return;

  for (const lock of locks) {
    const addr = lock.address;
    const card = document.querySelector(`.vault-card[data-addr="${addr}"]`);
    if (!card) continue;

    // 1) Price + feed update
    let detail;
    try {
      const vault = getPrimaryContract(addr, vaultAbi);
      
      detail = await safeCall(useFallback =>
        useFallback
          ? getFallbackContract(addr, vaultAbi).priceDetail()
          : vault.priceDetail()
      );
    } catch {
      continue;
    }

    const chosenPriceBN = detail[0];
    const primaryOK = detail[1];
    const primaryPxBN = detail[2];
    const primaryResBN = detail[3];
    const backupOK = detail[4];
    const backupPxBN = detail[5];
    const backupResBN = detail[6];
    const usedPrimary = detail[7];
    const usedBackup = detail[8];

    const priceFloat = Number(ethersLib.utils.formatUnits(chosenPriceBN, 18));

    const priceSpan = card.querySelector(
      ".vault-col-main .col1-line:nth-child(2) span.col1-value-bold"
    );
    if (priceSpan) priceSpan.textContent = `$${formatLockPrice(priceFloat)}`;

    const thresholdFloat = parseFloat(
      ethersLib.utils.formatUnits(lock.threshold, 18)
    );
    const pct = thresholdFloat
      ? Math.min(100, Math.max(0, (priceFloat / thresholdFloat) * 100))
      : 0;

    const pie = card.querySelector(".price-goal-pie");
    if (pie) {
      pie.style.background = `conic-gradient(#22c55e ${pct}%, #1f2937 ${pct}%)`;
    }
    const tooltip = card.querySelector(".pie-tooltip");
    if (tooltip) tooltip.textContent = `${pct.toFixed(2)}%`;

    const pResFloat = quoteResToUsdFloat(
      primaryResBN,
      lock.primaryQuoteDecimals
    );
    const bResFloat = quoteResToUsdFloat(
      backupResBN,
      lock.backupQuoteDecimals
    );

    const feedsInner = card.querySelector(".vault-col-feeds > div");
    if (feedsInner) {
      let html = "";
      if (primaryOK) {
        html += `<b>1°</b> : $${formatLockPrice(
          Number(ethersLib.utils.formatUnits(primaryPxBN, 18))
        )}, $reserves ≈ ${formatReserveK(pResFloat)}<br>`;
      }
      if (backupOK) {
        html += `<b>2°</b> : $${formatLockPrice(
          Number(ethersLib.utils.formatUnits(backupPxBN, 18))
        )}, $reserves ≈ ${formatReserveK(bResFloat)}<br>`;
      }
      if (usedPrimary) {
        html += `Effective: price=$${formatLockPrice(
          priceFloat
        )} via 𝟏° feed`;
      } else if (usedBackup) {
        html += `Effective: price=$${formatLockPrice(
          priceFloat
        )} via 𝟐° feed`;
      } else {
        html += `Effective: feeds unavailable — using time unlock only`;
      }
      feedsInner.innerHTML = html;
    }

    // 2) Live balance update (triggers instant Rescue-button)
    try {
      let newBalanceBN;
      if (lock.isNative) {
        newBalanceBN = await provider.getBalance(addr);
      } else {
        const erc20 = new ethersLib.Contract(lock.lockToken, erc20Abi, provider);
        newBalanceBN = await erc20.balanceOf(addr);
      }

      lock.balanceBN = newBalanceBN;
      const hasBalance = !newBalanceBN.isZero();

      const dec = lock.assetLabel === "HEX" ? 8 : 18;
      const newBalanceFloat = parseFloat(
        ethersLib.utils.formatUnits(newBalanceBN, dec)
      );

      const balanceSpan = card.querySelector(
        ".vault-col-main .col1-line:nth-child(4) span.col1-value-bold"
      );
      if (balanceSpan) {
        balanceSpan.textContent = `${newBalanceFloat.toFixed(
          4
        )} ${lock.assetLabel}`;
      }
      // --------------------------------------------
      // FOREIGN TOKEN RESCUE DETECTION + UI UPDATE
      // --------------------------------------------
      
      // Only owners can rescue
      if (lock.owner === userAddress) {
      
          const foreignRescue = [];
      
          // Check HEX (if not the locked asset)
          if (lock.assetLabel !== "HEX") {
              try {
                  const hexErc = new ethersLib.Contract(ADDR.HEX, erc20Abi, provider);
                  const hexBal = await hexErc.balanceOf(addr);
                  if (!hexBal.isZero()) {
                      foreignRescue.push({ token: "HEX", addr: ADDR.HEX });
                  }
              } catch (e) { console.error("HEX balance check error:", e); }
          }
      
          // Check pDAI (if not the locked asset)
          if (lock.assetLabel !== "pDAI") {
              try {
                  const pdaiErc = new ethersLib.Contract(ADDR.PDAI, erc20Abi, provider);
                  const pdaiBal = await pdaiErc.balanceOf(addr);
                  if (!pdaiBal.isZero()) {
                      foreignRescue.push({ token: "pDAI", addr: ADDR.PDAI });
                  }
              } catch (e) { console.error("pDAI balance check error:", e); }
          }
      
          // Inject into column
          const rescueCol = card.querySelector(".vault-col-rescue-foreign");
          if (rescueCol) {
              if (foreignRescue.length === 0) {
                  rescueCol.style.display = "none";
                  rescueCol.innerHTML = "";
              } else {
                  rescueCol.style.display = "flex";
                  rescueCol.innerHTML = "";
                  foreignRescue.forEach(fr => {
                      const btn = document.createElement("button");
                      btn.className = "vault-foreign-rescue-btn";
                      btn.textContent = "Rescue " + fr.token;
                      btn.onclick = async () => {
                          try {
                              const vaultC = new ethersLib.Contract(addr, vaultAbi, signer);
                              const tx = await vaultC.rescue(fr.addr);
                              await tx.wait();
                              await refreshSingleVault(addr);
                          } catch (err) {
                              alert("Rescue failed: " + (err?.message || err));
                          }
                      };
                      rescueCol.appendChild(btn);
                  });
              }
          }
      }
      // --------------------------------------------

      // Update RESCUE, WITHDRAW, and status tag
      const withdrawnTag = lock.withdrawn;
      const viaTime = lock.unlockTime <= Math.floor(Date.now() / 1000);
      const viaPrice =
        thresholdFloat > 0 && priceFloat >= thresholdFloat && lock.priceValid;

      const canWithdraw = !withdrawnTag && (viaTime || viaPrice);
      lock.canWithdraw = canWithdraw;

      const statusTag = card.querySelector(".tag");
      if (statusTag) {
        if (withdrawnTag) {
          statusTag.className = "tag status-warn";
          statusTag.textContent = "✖ WITHDRAWN ✖";
          card.classList.remove("vault-unlockable");
        } else if (canWithdraw) {
          statusTag.className = "tag status-ok";
          statusTag.textContent = "✔ UNLOCKED ✔";
          card.classList.add("vault-unlockable");
        } else {
          statusTag.className = "tag status-bad";
          statusTag.textContent = "🔒 LOCKED 🔒";
          card.classList.remove("vault-unlockable");
        }
      }

      const btnCol = card.querySelector(".vault-col-buttons");
      if (btnCol) {
        const withdrawBtn = btnCol.querySelector('button[data-role="withdraw"]');
        const rescueBtn = btnCol.querySelector('button[data-role="rescue"]');

        if (withdrawBtn) {
          withdrawBtn.disabled = !canWithdraw;
          withdrawBtn.style.display = withdrawnTag ? "none" : "inline-block";
        }

        if (rescueBtn) {
          const showRescue = withdrawnTag && hasBalance;
          rescueBtn.style.display = showRescue ? "inline-block" : "none";
        }
      }
    } catch (err) {
      console.error("Balance refresh error:", err);
    }
  }
}

// -------------------------------
// Collapse / Expand
// -------------------------------
function minimizeVault(addr) {
  setCollapsed(addr, true);
  const card = document.querySelector(`.vault-card[data-addr="${addr}"]`);
  if (card) card.classList.add("collapsed");
}

function maximizeVault(addr) {
  setCollapsed(addr, false);
  const card = document.querySelector(`.vault-card[data-addr="${addr}"]`);
  if (card) card.classList.remove("collapsed");
}

function toggleVault(addr) {
  const lower = addr.toLowerCase();
  const nowCollapsed = isCollapsed(lower);
  setCollapsed(lower, !nowCollapsed);

  const card = document.querySelector(`.vault-card[data-addr="${lower}"]`);
  if (!card) return;

  card.classList.toggle("collapsed", !nowCollapsed);

  // Update the button label dynamically
  const btn = card.querySelector(".minmax-btn");
  if (btn) btn.textContent = !nowCollapsed ? "▼ Max" : "▲ Min";
}

// -------------------------------
// WITHDRAW (no flash)
// -------------------------------
async function withdrawVault(addr) {
  try {
    if (!signer) {
      alert("Connect wallet first.");
      return;
    }

    const vault = new ethersLib.Contract(addr, vaultAbi, signer);
    const tx = await vault.withdraw();
    await tx.wait();

    // NO FULL RELOAD — update ONLY this card
    await refreshSingleVault(addr);

  } catch (err) {
    alert("Withdraw failed: " + (err?.message || err));
    console.error("Withdraw error:", err);
  }
}

// -------------------------------
// RESCUE (no flash)
// -------------------------------
async function rescueVault(addr) {
  try {
    if (!signer) {
      alert("Connect wallet first.");
      return;
    }

    const lower = addr.toLowerCase();
    const vault = new ethersLib.Contract(addr, vaultAbi, signer);

    const lock = locks.find(l => l.address === lower);
    if (!lock) {
      alert("Vault not found in memory.");
      return;
    }

    let tx;
    if (lock.isNative) {
      tx = await vault.rescueNative();
    } else {
      tx = await vault.rescue(lock.lockToken);
    }

    await tx.wait();

    // NO FULL RELOAD — update only this one
    await refreshSingleVault(addr);

  } catch (err) {
    alert("Rescue failed: " + (err?.message || err));
    console.error("Rescue error:", err);
  }
}

// -------------------------------
// REMOVE (no flash, no reload)
// -------------------------------
function removeVault(addr) {
  const lower = addr.toLowerCase();

  const list = getLocalVaults().filter(a => a !== lower);
  setLocalVaultList(list);

  const card = document.querySelector(`.vault-card[data-addr="${lower}"]`);
  if (card) {
    card.style.opacity = "0";
    setTimeout(() => card.remove(), 150);
  }

  // Do NOT reload everything — keep all other cards untouched
}

// -------------------------------
// COPY ADDRESS WITH POPUP
// -------------------------------
function copyAddr(addr, ev) {
  navigator.clipboard.writeText(addr)
    .then(() => {
      const btn = ev.target.closest(".copy-icon-btn");
      if (!btn) return;

      const popup = document.createElement("div");
      popup.className = "copy-popup";
      popup.textContent = "Copied";
      btn.appendChild(popup);

      setTimeout(() => popup.remove(), 900);
    })
    .catch(err => console.error("Copy failed:", err));
}

// -------------------------------
// ADD VAULT MANUALLY (NO FLASH)
// -------------------------------
addVaultBtn.addEventListener("click", async () => {
  if (!provider) {
    manualAddStatus.textContent = "Connect wallet first.";
    return;
  }

  const addr = manualVaultInput.value.trim();
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    manualAddStatus.textContent = "Invalid address.";
    return;
  }

  const lower = addr.toLowerCase();
  saveLocalVaultAddress(lower);

  manualAddStatus.textContent = "Vault added.";
  manualVaultInput.value = "";

  // ✨ NO FLASH — only soft-load this vault
  await softLoadSingleVault(lower);
});

// "Restore All Vaults" button
document.getElementById("restoreVaultsBtn")
  .addEventListener("click", restoreAllVaults);

// -------------------------------
// Utilities
// -------------------------------
function formatTimestamp(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function formatCountdownNumber(diff) {
  if (diff <= 0) return "0s";

  let d = Math.floor(diff / 86400);
  diff %= 86400;
  let h = Math.floor(diff / 3600);
  diff %= 3600;
  let m = Math.floor(diff / 60);
  let s = diff % 60;

  const parts = [];
  if (d) parts.push(d + "d");
  if (h) parts.push(h + "h");
  if (m) parts.push(m + "m");
  if (!d && !h && !m) parts.push(s + "s");
  return parts.join(" ");
}
