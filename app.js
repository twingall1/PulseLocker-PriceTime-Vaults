// ================================
// app.js — V9.1, improved wide 5-column vault layout
// ================================

console.log("Generic vault app.js loaded (V9.1 wide cards).");

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

// collapse state helpers
function isCollapsed(addr) {
  const c = localStorage.getItem("vaultCollapsed-" + addr.toLowerCase());
  return c === "1";
}
function setCollapsed(addr, collapsed) {
  localStorage.setItem("vaultCollapsed-" + addr.toLowerCase(), collapsed ? "1" : "0");
}

// -------------------------------
// CONFIG
// -------------------------------
const FACTORY_ADDRESS = "0xf6aDe1a6db5bD96aD782E7AA1F566D11166719F0".toLowerCase();

const ADDR = {
  DAI:  "0xefD766cCb38EaF1dfd701853BFCe31359239F305".toLowerCase(),
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27".toLowerCase(),
  PDAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase(),
  HEX:  "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39".toLowerCase(),
  USDC: "0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07".toLowerCase(),

  PLS_DAI_V1_PAIR: "0xE56043671df55dE5CDf8459710433C10324DE0aE".toLowerCase(),
  PLS_DAI_V2_PAIR: "0x146E1f1e060e5b5016Db0D118D2C5a11A240ae32".toLowerCase(),

  PDAI_DAI_V2_PAIR: "0xfC64556FAA683e6087F425819C7Ca3C558e13aC1".toLowerCase(),
  PDAI_DAI_V1_PAIR: "0x1D2be6eFf95Ac5C380a8D6a6143b6a97dd9D8712".toLowerCase(),

  HEX_DAI_V1_PAIR:  "0x6F1747370B1CAcb911ad6D4477b718633DB328c8".toLowerCase(),
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

Object.keys(ASSETS).forEach(code => {
  ASSETS[code].pair = ASSETS[code].primaryPair;
});

// ABIs
const factoryAbi = [
  "event VaultCreated(address indexed owner, address vault, bytes32 assetKey, uint256 priceThresholdUsd1e18, uint256 unlockTime)",
  "function createVault(bytes32 assetKey, uint256 priceThresholdUsd1e18, uint256 unlockTime) external returns (address)",
  "function getVaultsByOwner(address owner) view returns (address[] memory)"   // 👈 NEW
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
  "function rescue(address token) external",       // NEW
  "function rescueNative() external"               // NEW
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

const connectBtn       = document.getElementById("connectBtn");
const walletSpan       = document.getElementById("walletAddress");
const networkInfo      = document.getElementById("networkInfo");
const themeToggleBtn   = document.getElementById("themeToggle");

const assetSelect      = document.getElementById("assetSelect");
const createForm       = document.getElementById("createForm");
const targetPriceInput = document.getElementById("targetPrice");
const unlockDateInput  = document.getElementById("unlockDateTime");
const createBtn        = document.getElementById("createBtn");
const createStatus     = document.getElementById("createStatus");

const pairAddressSpan  = document.getElementById("pairAddress");
const globalPriceDiv   = document.getElementById("globalPrice");
const globalPriceRaw   = document.getElementById("globalPriceRaw");

const manualVaultInput = document.getElementById("manualVaultInput");
const addVaultBtn      = document.getElementById("addVaultBtn");
const manualAddStatus  = document.getElementById("manualAddStatus");

const locksContainer   = document.getElementById("locksContainer");

// THEME TOGGLE
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
// --- switch to pulsechain ---
async function switchToPulseChain() {
  if (!window.ethereum) {
    alert("No wallet detected.");
    return;
  }

  try {
    // Try switching directly
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x171" }]
    });
  } catch (err) {
    // If missing, attempt to add
    if (err.code === 4902 || (err.message && err.message.includes("4902"))) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x171",
            chainName: "PulseChain",
            rpcUrls: ["https://rpc.pulsechain.com"],
            blockExplorerUrls: ["https://scan.pulsechain.com"],
            nativeCurrency: {
              name: "Pulse",
              symbol: "PLS",
              decimals: 18
            }
          }]
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

  // --- NEW PART: connect automatically after switching ---  
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    // Use your existing connect() logic to update the UI
    await connect();
  } catch (connErr) {
    alert("Network switched, but wallet connection failed: " + connErr.message);
  }
}

// --- End insertion ---

// CONNECT
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
    
    // NEW: update button state
    connectBtn.textContent = "Connected ✓";
    connectBtn.disabled = true;
    
    // ⭐ NEW: show disconnect icon
    document.getElementById("disconnectBtn").style.display = "flex";

    const net = await provider.getNetwork();
    walletSpan.textContent = userAddress;
        // NETWORK DISPLAY (normal for PulseChain mainnet)
    if (net.chainId === 369) {
      networkInfo.innerHTML = `
        <span style="color:#6b7280;">Connected (chainId: 369)</span>
      `;
    } 
    // WRONG NETWORK WARNING (red, inline, no extra space)
    else {
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
    


    factoryContract = new ethersLib.Contract(FACTORY_ADDRESS, factoryAbi, signer);

    await refreshGlobalPrice();
    await loadLocalVaults();     // this already calls renderLocks() once

    // Initial static render of all vault cards
    renderLocks();
    updateVaultPrices(); //add this to force update at start so no delays in pie chart color fill

    // Start dynamic refresh loops: time (1s) and price/feeds (5s)
    startTimeRefresh();
    setInterval(updateVaultPrices, 5000);


  } catch (err) {
    alert("Connection failed: " + err.message);
    console.error(err);
  }
}
connectBtn.addEventListener("click", connect);
document.getElementById("disconnectBtn").addEventListener("click", () => {

  // Reset UI
  walletSpan.textContent = "";
  networkInfo.textContent = "";
  
  connectBtn.textContent = "Connect Wallet";
  connectBtn.disabled = false;

  // Hide disconnect icon
  document.getElementById("disconnectBtn").style.display = "none";

  // Reset internal state
  userAddress = null;
  signer = null;
  provider = null;

  // Clear vault UI
  locksContainer.textContent = "Connect wallet to load.";
});

// ---------------------------------------------------
// AUTO UI UPDATE ON NETWORK CHANGE (NO POPUPS)
// ---------------------------------------------------
if (window.ethereum) {
  window.ethereum.on("chainChanged", async (chainIdHex) => {
    const chainId = parseInt(chainIdHex, 16);

    // Always show disconnect icon if a wallet is connected
    document.getElementById("disconnectBtn").style.display = "flex";

    if (chainId === 369) {
      // PulseChain correct
      networkInfo.innerHTML = `
        <span style="color:#6b7280;">Connected (chainId: 369)</span>
      `;
      connectBtn.textContent = "Connected ✓";
      connectBtn.disabled = true;

    } else {
      // Wrong network
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

    // Update global feed instantly
    refreshGlobalPrice();

    // Update wallet address label
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length) {
      walletSpan.textContent = accounts[0].toLowerCase();
    }
  });
}



// ---------------------------------------------------
// AUTO-REFRESH WALLET UI ON NETWORK / ACCOUNT CHANGES
// ---------------------------------------------------
if (window.ethereum) {


  // Handle account changes
  window.ethereum.on("accountsChanged", async () => {
    // If no accounts, reset UI (optional)
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (!accounts.length) {
      walletSpan.textContent = "";
      connectBtn.textContent = "Connect Wallet";
      connectBtn.disabled = false;
      return;
    }

    // Otherwise reconnect normally
    await connect();
  });
}


// PRICE HELPERS
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

// GLOBAL PRICE FEED
async function refreshGlobalPrice() {
  try {
    // NEW: short-circuit if no provider yet
    if (!provider) {
      globalPriceDiv.textContent = "Connect wallet to fetch live prices.";
      globalPriceRaw.textContent = "";
      return;
    }

    const assetCode = assetSelect.value;
    const cfg = ASSETS[assetCode];
    if (!cfg) return;

    pairAddressSpan.textContent = cfg.primaryPair;

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

    html += `<div class="small"><b>Primary feed:</b> ${cfg.primaryFeedLabel}<br>`;
    if (!primaryInfo.ok) {
      html += `Status: <span class="status-bad">unavailable</span>`;
    } else {
      html += `Status: <span class="status-ok">ok</span><br>`;
      html += `Price: 1 ${cfg.label} ≈ $${formatLockPrice(primaryInfo.priceFloat)}, &nbsp;USD-side reserves: $${formatReserveK(primaryInfo.quoteResFloat)}</div>`;

    }

    if (cfg.backupPair) {
      html += `<div class="small" style="margin-top:8px;"><b>Backup feed:</b> ${cfg.backupFeedLabel}<br>`;
      if (!backupInfo.ok) {
        html += `Status: <span class="status-bad">unavailable</span>`;
      } else {
        html += `Status: <span class="status-ok">ok</span><br>`;
        html += `Price: 1 ${cfg.label} ≈ $${formatLockPrice(backupInfo.priceFloat)}, &nbsp;USD-side reserves: $${formatReserveK(backupInfo.quoteResFloat)}</div>`;

      }
    }

    html += `<div class="small" style="margin-top:8px;">`;
    if (chosenSource === "primary") {
      html += `Effective price (logic): <b>$${formatLockPrice(chosenPriceFloat)}</b> via <b>𝟏° feed</b> (larger USD-side reserves).`;
    } else if (chosenSource === "backup") {
      html += `Effective price (logic): <b>$${formatLockPrice(chosenPriceFloat)}</b> via <b>𝟐° feed</b> (larger USD-side reserves).`;
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

setInterval(refreshGlobalPrice, 5000);
assetSelect.addEventListener("change", refreshGlobalPrice);

async function computePairPriceAndLiquidity(pairAddr, lockToken, lockDecimals, quoteToken, quoteDecimals) {
  if (!pairAddr) return { ok: false };

  try {
    const pair = new ethersLib.Contract(pairAddr, pairAbi, provider);
    const [r0, r1] = await pair.getReserves();
    if (r0.eq(0) || r1.eq(0)) return { ok: false };

    const token0 = (await pair.token0()).toLowerCase();
    const token1 = (await pair.token1()).toLowerCase();

    let lockRes, quoteRes;
    if (token0 === lockToken && token1 === quoteToken) {
      lockRes  = r0;
      quoteRes = r1;
    } else if (token1 === lockToken && token0 === quoteToken) {
      lockRes  = r1;
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

// LOCAL STORAGE & VAULT LIST
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
// -----------------------------------------
// RESTORE ALL VAULTS EVER CREATED BY THIS WALLET (on-chain scan)
// -----------------------------------------
async function restoreAllVaults() {
  if (!provider || !userAddress) {
    manualAddStatus.textContent = "Connect wallet first.";
    return;
  }

  try {
    manualAddStatus.textContent = "Checking contract registry...";

    // Call the new V9.2 factory view
    const vaultList = await factoryContract.getVaultsByOwner(userAddress);

    if (!vaultList.length) {
      manualAddStatus.textContent = "No vaults found for this wallet.";
      return;
    }

    let count = 0;
    for (const v of vaultList) {
      const addr = v.toLowerCase();
      saveLocalVaultAddress(addr);  // still dedupes, as before
      count++;
    }

    manualAddStatus.textContent = `Restored ${count} vault(s).`;
    await loadLocalVaults();

  } catch (err) {
    manualAddStatus.textContent = "Restore failed: " + err.message;
    console.error("Restore error:", err);
  }
}


// CREATE VAULT
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

        // NEW: prevent past or current times
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
      await loadLocalVaults();
    }

  } catch (err) {
    createStatus.textContent = "Error: " + (err && err.message ? err.message : String(err));
    console.error(err);
  } finally {
    createBtn.disabled = false;
  }
});


// ---------------------------------------------

function moveVaultUp(addr) {
  const list = getLocalVaults();
  const idx = list.findIndex(a => a.toLowerCase() === addr.toLowerCase());
  if (idx > 0) {
    const temp = list[idx - 1];
    list[idx - 1] = list[idx];
    list[idx] = temp;
    localStorage.setItem(localKey(), JSON.stringify(list));
    loadLocalVaults();
  }
}

function moveVaultDown(addr) {
  const list = getLocalVaults();
  const idx = list.findIndex(a => a.toLowerCase() === addr.toLowerCase());
  if (idx < list.length - 1) {
    const temp = list[idx + 1];
    list[idx + 1] = list[idx];
    list[idx] = temp;
    localStorage.setItem(localKey(), JSON.stringify(list));
    loadLocalVaults();
  }
}

// LOAD LOCAL VAULTS
async function loadLocalVaults() {
  const list = getLocalVaults();
  
  if (!list.length) {
    locksContainer.textContent = "No locks found.";
    locks = [];
    return;
  }

  locksContainer.classList.add("is-loading");
  
  const results = [];

  for (const addr of list) {
    try {
      const vault = new ethersLib.Contract(addr, vaultAbi, provider);

      const [
        owner,
        lockToken,
        isNative,
        threshold,
        unlockTime,
        startTime,
        withdrawn,
        primaryQuoteToken,
        backupQuoteToken,
        primaryPair,
        backupPair,
        primaryLockTokenIsToken0,
        backupLockTokenIsToken0,
      ] = await Promise.all([
        vault.owner(),
        vault.lockToken(),
        vault.isNative(),
        vault.priceThreshold(),
        vault.unlockTime(),
        vault.startTime(),
        vault.withdrawn(),
        vault.primaryQuoteToken(),
        vault.backupQuoteToken(),
        vault.primaryPair(),
        vault.backupPair(),
        vault.primaryLockTokenIsToken0(),
        vault.backupLockTokenIsToken0()
      ]);

      const lockTokenLower = lockToken.toLowerCase();
      const assetLabel = detectAssetLabel(lockTokenLower, isNative);

      let cfgByLabel = null;
      if (assetLabel === "PLS") cfgByLabel = ASSETS.PLS;
      else if (assetLabel === "pDAI") cfgByLabel = ASSETS.PDAI;
      else if (assetLabel === "HEX") cfgByLabel = ASSETS.HEX;

      const lockDecimals         = cfgByLabel ? cfgByLabel.lockDecimals         : 18;
      const primaryQuoteDecimals = cfgByLabel ? cfgByLabel.primaryQuoteDecimals : 18;
      const backupQuoteDecimals  = cfgByLabel ? cfgByLabel.backupQuoteDecimals  : 18;

      let balanceBN;
      if (isNative) {
        balanceBN = await provider.getBalance(addr);
      } else {
        const erc20 = new ethersLib.Contract(lockToken, erc20Abi, provider);
        balanceBN = await erc20.balanceOf(addr);
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
        const detail = await vault.priceDetail();
        chosenPriceBN     = detail[0];
        primaryValid      = detail[1];
        primaryPriceBN    = detail[2];
        primaryQuoteResBN = detail[3];
        backupValid       = detail[4];
        backupPriceBN     = detail[5];
        backupQuoteResBN  = detail[6];
        usedPrimary       = detail[7];
        usedBackup        = detail[8];
        priceValid        = detail[9];
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

      results.push({
        address: addr.toLowerCase(),
        assetLabel,
        lockToken: lockTokenLower,
        primaryQuoteToken: primaryQuoteToken.toLowerCase(),
        backupQuoteToken:  backupQuoteToken.toLowerCase(),
        primaryPair:       primaryPair.toLowerCase(),
        backupPair:        backupPair.toLowerCase(),
        primaryLockTokenIsToken0,
        backupLockTokenIsToken0,
        isNative,
        threshold,
        unlockTime: unlockTime.toNumber(),
        startTime:  startTime.toNumber(),
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
      });

    } catch (err) {
      console.error("Vault load error:", addr, err);
      results.push({ address: addr.toLowerCase(), error: true });
    }
  }

  locks = results;
  renderLocks();
  updateVaultPrices(); 
  locksContainer.classList.remove("is-loading");
}

function detectAssetLabel(lockTokenAddr, isNative) {
  if (isNative) return "PLS";

  const addr = lockTokenAddr.toLowerCase();
  if (addr === ADDR.PDAI) return "pDAI";
  if (addr === ADDR.HEX)  return "HEX";

  return "Unknown";
}
// -------------------------------
// RENDER LOCK CARDS (wide 5-column layout + collapse)
// -------------------------------
function renderLocks() {
  if (!locks.length) {
    locksContainer.textContent = "No locks found.";
    return;
  }

  const nowTs = Math.floor(Date.now() / 1000);

  locksContainer.innerHTML = locks.map((lock, index) => {


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

    const assetLabel   = lock.assetLabel;
    const addrFull     = lock.address;
    const collapsedCls = isCollapsed(addrFull) ? "collapsed" : "";

    // Prices
    const thresholdFloat = parseFloat(
      ethersLib.utils.formatUnits(lock.threshold, 18)
    );
    const currentPriceFloat = (lock.priceValid && lock.chosenPriceBN.gt(0))
      ? parseFloat(ethersLib.utils.formatUnits(lock.chosenPriceBN, 18))
      : 0;

    // Balance
    const balanceDisplayDecimals = (assetLabel === "HEX") ? 8 : 18;
    const balanceFloat = parseFloat(
      ethersLib.utils.formatUnits(lock.balanceBN, balanceDisplayDecimals)
    );

    // Status
    // Truth: vault was withdrawn at least once
    const withdrawnTag = lock.withdrawn;
    const hasBalance = !lock.balanceBN.isZero();
    const canWithdraw = lock.canWithdraw && !withdrawnTag;
    const showRescue = withdrawnTag && hasBalance;


    const status =
      withdrawnTag
        ? '<span class="tag status-warn">✖ WITHDRAWN ✖</span>'
        : canWithdraw
        ? '<span class="tag status-ok">✔ UNLOCKABLE ✔</span>'
        : '<span class="tag status-bad">🔒 LOCKED 🔒</span>';

    // Price goal %
    let priceGoalPct = 0;
    if (thresholdFloat > 0 && currentPriceFloat > 0) {
      priceGoalPct = (currentPriceFloat / thresholdFloat) * 100;
    }
    if (priceGoalPct > 100) priceGoalPct = 100;
    if (priceGoalPct < 0)   priceGoalPct = 0;

    // Time goal %
    let timeGoalPct = 0;
    let timeLabel = "";
    if (lock.startTime && lock.unlockTime && lock.unlockTime > lock.startTime) {
      const total = lock.unlockTime - lock.startTime;
      const done  = Math.min(nowTs, lock.unlockTime) - lock.startTime;
      timeGoalPct = Math.max(0, Math.min(100, (done / total) * 100));
      const secsLeft = Math.max(0, lock.unlockTime - nowTs);
      timeLabel = formatCountdownNumber(secsLeft) + " remaining";
    } else {
      timeGoalPct = 0;
      timeLabel = "N/A";
    }
    const timeBarStyle = `width:${timeGoalPct.toFixed(1)}%;`;

    // Feed details
    const primaryPriceFloat = lock.primaryValid
      ? parseFloat(ethersLib.utils.formatUnits(lock.primaryPriceBN, 18))
      : 0;

    const backupPriceFloat = lock.backupValid
      ? parseFloat(ethersLib.utils.formatUnits(lock.backupPriceBN, 18))
      : 0;

    const primaryQuoteResFloat = lock.primaryQuoteResBN.gt(0)
      ? quoteResToUsdFloat(lock.primaryQuoteResBN, lock.primaryQuoteDecimals)
      : 0;

    const backupQuoteResFloat = lock.backupQuoteResBN.gt(0)
      ? quoteResToUsdFloat(lock.backupQuoteResBN, lock.backupQuoteDecimals)
      : 0;

    const effectiveLine =
      lock.usedPrimary
        ? `Effective price= $${formatLockPrice(currentPriceFloat)} via 𝟏° feed`
        : lock.usedBackup
        ? `Effective price= $${formatLockPrice(currentPriceFloat)} via 𝟐° feed`
        : `Effective price= feeds unavailable — using time unlock only`;

    // Render card
    return `
      <div class="card vault-card ${collapsedCls} ${canWithdraw ? 'vault-unlockable' : ''}"
           data-addr="${addrFull}">


        <!-- ROW 1: HEADER -->
        <div class="vault-header">
        
          <span class="vault-asset-label">
            ${TOKEN_ICONS[assetLabel] ? `<img src="${TOKEN_ICONS[assetLabel]}" class="token-mini">` : ""}
            ${assetLabel} VAULT
          </span>
          ${status}
        
          <!-- Address box -->
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
        

          <!-- Copy icon -->
          <div class="copy-icon-btn" onclick="copyAddr('${addrFull}', event)">
            <svg viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>

            </svg>
          </div>

        
          <!-- Min/Max buttons -->
          <button class="minimize-btn" onclick="minimizeVault('${addrFull}')">▲ Min</button>
          <button class="maximize-btn" onclick="maximizeVault('${addrFull}')">▼ Max</button>
          <div class="reorder-buttons">
            ${index > 0 ? `<div class="reorder-up" onclick="moveVaultUp('${addrFull}')">▲</div>` : ``}
            ${index < locks.length - 1 ? `<div class="reorder-down" onclick="moveVaultDown('${addrFull}')">▼</div>` : ``}
          </div>

        
        </div>


        <!-- BODY: 5 columns -->
        <div class="vault-body">

          <!-- COL 1: main info text (aligned colons, bold values) -->
          <div class="vault-col-main">
            <div class="col1-line">
              target&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:
              &nbsp;<span class="col1-value-bold">1 ${assetLabel} ≥ $${formatLockPrice(thresholdFloat)}</span>
            </div>
            <div class="col1-line">
              current&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:
              &nbsp;<span class="col1-value-bold">$${formatLockPrice(currentPriceFloat)}</span>
            </div>
            <div class="col1-line">
              time&nbsp;unlock&nbsp;:
              &nbsp;<span class="col1-value-bold">${formatTimestamp(lock.unlockTime)}</span>
            </div>
            <div class="col1-line">
              locked&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:
              &nbsp;<span class="col1-value-bold">${balanceFloat.toFixed(4)} ${assetLabel}</span>
            </div>
          </div>

          <!-- COL 2: buttons (bottom-aligned) -->
          <div class="vault-col-buttons">
          
            ${(!withdrawnTag) ? `
              <button data-role="withdraw" onclick="withdrawVault('${addrFull}')"
                ${canWithdraw ? "" : "disabled"}>
                Withdraw
              </button>
            ` : ``}
          
            ${(showRescue) ? `
              <button data-role="rescue" onclick="rescueVault('${addrFull}')"
                style="background:#1d4ed8;color:white;">
                Rescue
              </button>
            ` : ``}
          
            <button data-role="remove" onclick="removeVault('${addrFull}')"
              style="background:#b91c1c;">
              Remove
            </button>
          
          </div>


          <!-- COL 3: pie chart -->
          <div class="vault-col-pie">
            <div class="small" style="text-align:center;">Price goal</div>
            <div class="pie-wrapper">
              <div class="price-goal-pie"></div>
              <div class="pie-tooltip">${priceGoalPct.toFixed(2)}%</div>
            </div>


          </div>

          <!-- COL 4: time progress -->
          <div class="vault-col-time">
            <div class="small">Time progress</div>
            <div class="time-progress-bar-bg">
              <div class="time-progress-bar-fill" style="${timeBarStyle}"></div>
            </div>
            <div class="small">${timeLabel}</div>
          </div>

          <!-- COL 5: feed details -->
          <div class="vault-col-feeds">
            <div>
              <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <b>1°</b> : $${formatLockPrice(primaryPriceFloat)}, $reserves ≈ ${formatReserveK(primaryQuoteResFloat)}
              </div>
              <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <b>2°</b> : $${formatLockPrice(backupPriceFloat)}, $reserves ≈ ${formatReserveK(backupQuoteResFloat)}
              </div>
              <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${effectiveLine}
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  }).join("");
// --- Attach instant pie tooltip handlers AFTER DOM paint (fixes slow pie loading) ---
// --- Attach instant pie tooltip handlers AFTER DOM paint (fixes slow pie loading) ---
requestAnimationFrame(() => {
  const cards = locksContainer.querySelectorAll(".vault-card");

  cards.forEach(card => {
    // ---------------------
    // PIE TOOLTIP HANDLERS
    // ---------------------
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
});


}
// -----------------------------------------
// TIME + PRICE REFRESH (no full card re-renders)
// -----------------------------------------
function startTimeRefresh() {
  setInterval(() => {
    if (!locks.length) return;
    const nowTs = Math.floor(Date.now() / 1000);

    for (const lock of locks) {
      if (!lock.startTime || !lock.unlockTime || lock.unlockTime <= lock.startTime) continue;

      const total    = lock.unlockTime - lock.startTime;
      const done     = Math.min(nowTs, lock.unlockTime) - lock.startTime;
      const pct      = Math.max(0, Math.min(100, (done / total) * 100));
      const secsLeft = Math.max(0, lock.unlockTime - nowTs);

      const card = document.querySelector(`.vault-card[data-addr="${lock.address}"]`);
      if (!card) continue;

      const barFill = card.querySelector(".time-progress-bar-fill");
      const labelEl = card.querySelector(".vault-col-time .small:last-child");

      if (barFill) barFill.style.width = `${pct.toFixed(1)}%`;
      if (labelEl) labelEl.textContent = formatCountdownNumber(secsLeft) + " remaining";
    }
  }, 1000);
}

async function updateVaultPrices() {
  if (!locks.length) return;

  for (const lock of locks) {
    const addr = lock.address;
    const card = document.querySelector(`.vault-card[data-addr="${addr}"]`);
    if (!card) continue;

    // ==========================================================
    // 1) Refresh price + feed details
    // ==========================================================
    let detail;
    try {
      const vault = new ethersLib.Contract(addr, vaultAbi, provider);
      detail = await vault.priceDetail();
    } catch {
      continue;
    }

    const chosenPriceBN = detail[0];
    const primaryOK     = detail[1];
    const primaryPxBN   = detail[2];
    const primaryResBN  = detail[3];
    const backupOK      = detail[4];
    const backupPxBN    = detail[5];
    const backupResBN   = detail[6];
    const usedPrimary   = detail[7];
    const usedBackup    = detail[8];

    const priceFloat = Number(ethersLib.utils.formatUnits(chosenPriceBN, 18));

    // CURRENT price (col 1, second line span)
    const priceSpan = card.querySelector(
      ".vault-col-main .col1-line:nth-child(2) span.col1-value-bold"
    );
    if (priceSpan) priceSpan.textContent = `$${formatLockPrice(priceFloat)}`;

    // PIE chart
    const thresholdFloat = parseFloat(
      ethersLib.utils.formatUnits(lock.threshold, 18)
    );
    const pctGoal = Math.min(
      100,
      Math.max(0, (priceFloat / thresholdFloat) * 100)
    );
    const pie = card.querySelector(".price-goal-pie");
    if (pie) {
      pie.style.background = `conic-gradient(#22c55e ${pctGoal}%, #020617 ${pctGoal}%)`;
    }
    const tooltip = card.querySelector(".pie-tooltip");
    if (tooltip) {
      tooltip.textContent = `${pctGoal.toFixed(2)}%`;
    }

    // FEED details (col 5)
    const primaryPxFloat = Number(
      ethersLib.utils.formatUnits(primaryPxBN, 18)
    );
    const backupPxFloat = Number(
      ethersLib.utils.formatUnits(backupPxBN, 18)
    );

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
          primaryPxFloat
        )}, $reserves ≈ ${formatReserveK(pResFloat)}<br>`;
      }
      if (backupOK) {
        html += `<b>2°</b> : $${formatLockPrice(
          backupPxFloat
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

    // ==========================================================
    // 2) Refresh locked balance every 5 seconds
    // ==========================================================
    try {
      let newBalanceBN;
      if (lock.isNative) {
        newBalanceBN = await provider.getBalance(addr);
      } else {
        const erc20 = new ethersLib.Contract(
          lock.lockToken,
          erc20Abi,
          provider
        );
        newBalanceBN = await erc20.balanceOf(addr);
      }

      lock.balanceBN = newBalanceBN;

      const balanceDisplayDecimals =
        lock.assetLabel === "HEX" ? 8 : 18;
      const newBalanceFloat = parseFloat(
        ethersLib.utils.formatUnits(
          newBalanceBN,
          balanceDisplayDecimals
        )
      );

      const balanceSpan = card.querySelector(
        ".vault-col-main .col1-line:nth-child(4) span.col1-value-bold"
      );

      if (balanceSpan) {
        balanceSpan.textContent = `${newBalanceFloat.toFixed(
          4
        )} ${lock.assetLabel}`;
      }
    } catch (err) {
      console.error("Balance refresh error:", err);
    }

    // ==========================================================
    // 3) (NEW) Dynamic unlock logic + status refresh
    // ==========================================================
    const withdrawnTag = lock.withdrawn;
    const hasBalance   = !lock.balanceBN.isZero();
    
    const nowTs = Math.floor(Date.now() / 1000);
    
    // Local recomputation of unlockability (same logic as Solidity)
    const viaTime  = nowTs >= lock.unlockTime;
    const viaPrice = priceFloat > 0 &&
                     thresholdFloat > 0 &&
                     priceFloat >= thresholdFloat;
    
    const canWithdrawUI = !withdrawnTag && (viaTime || viaPrice);
    
    // Maintain memory sync
    lock.canWithdraw = canWithdrawUI;
    
    // Update STATUS TAG
    const statusTag = card.querySelector(".tag");
    if (statusTag) {
      if (withdrawnTag) {
        statusTag.classList.remove("status-ok", "status-bad");
        statusTag.classList.add("status-warn");
        statusTag.textContent = "✖ WITHDRAWN ✖";
        card.classList.remove("vault-unlockable");
      } else if (canWithdrawUI) {
        statusTag.classList.remove("status-bad", "status-warn");
        statusTag.classList.add("status-ok");
        statusTag.textContent = "✔ UNLOCKABLE ✔";
        card.classList.add("vault-unlockable");
      } else {
        statusTag.classList.remove("status-ok", "status-warn");
        statusTag.classList.add("status-bad");
        statusTag.textContent = "🔒 LOCKED 🔒";
        card.classList.remove("vault-unlockable");
      }
    }
    
    // BUTTON CONTAINER
    const buttonCol = card.querySelector(".vault-col-buttons");
    if (!buttonCol) continue;
    
    const withdrawBtn = buttonCol.querySelector('button[data-role="withdraw"]');
    const rescueBtn   = buttonCol.querySelector('button[data-role="rescue"]');
    const removeBtn   = buttonCol.querySelector('button[data-role="remove"]'); // always exists
    
    // WITHDRAW button
    if (withdrawnTag) {
      if (withdrawBtn) withdrawBtn.style.display = "none";
    } else {
      if (withdrawBtn) {
        withdrawBtn.style.display = "inline-block";
        withdrawBtn.disabled = !canWithdrawUI;
      }
    }
    
    // RESCUE button (only AFTER withdrawn)
    if (rescueBtn) {
      const showRescue = withdrawnTag && hasBalance;
      rescueBtn.style.display = showRescue ? "inline-block" : "none";
    }

  } // END for(lock)
}


// COLLAPSE / EXPAND
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

// WITHDRAW
async function withdrawVault(addr) {
  try {
    if (!signer) {
      alert("Connect wallet first.");
      return;
    }
    const vault = new ethersLib.Contract(addr, vaultAbi, signer);
    const tx = await vault.withdraw();
    await tx.wait();
    await loadLocalVaults();
  } catch (err) {
    alert("Withdraw failed: " + (err && err.message ? err.message : String(err)));
    console.error("Withdraw error:", err);
  }
}
// RESCUE FUNDS (V9.3 rescue method)
async function rescueVault(addr) {
  try {
    if (!signer) {
      alert("Connect wallet first.");
      return;
    }

    const lower = addr.toLowerCase();
    const vault = new ethersLib.Contract(addr, vaultAbi, signer);

    // Find vault in local state
    const lock = locks.find(l => l.address === lower);
    if (!lock) {
      alert("Vault not found in memory.");
      return;
    }

    let tx;
    if (lock.isNative) {
      // rescue native PLS
      tx = await vault.rescueNative();
    } else {
      // rescue the lock token OR other ERC20 tokens
      tx = await vault.rescue(lock.lockToken);
    }

    await tx.wait();
    await loadLocalVaults();

  } catch (err) {
    alert("Rescue failed: " + (err && err.message ? err.message : String(err)));
    console.error("Rescue error:", err);
  }
}


// REMOVE VAULT
function removeVault(addr) {
  const lower = addr.toLowerCase();

  // 1. Update localStorage
  const list = getLocalVaults().filter(a => a.toLowerCase() !== lower);
  localStorage.setItem(localKey(), JSON.stringify(list));

  // 2. Remove card from DOM only
  const card = document.querySelector(`.vault-card[data-addr="${lower}"]`);
  if (card) {
    card.style.opacity = "0";
    setTimeout(() => card.remove(), 150);
  }

  // 3. Do NOT reload everything
}

// COPY ADDRESS (with popup)
function copyAddr(addr, ev) {
  navigator.clipboard.writeText(addr).then(() => {
    try {
      const btn = ev.target.closest(".copy-icon-btn");
      if (!btn) return;

      const popup = document.createElement("div");
      popup.className = "copy-popup";
      popup.textContent = "Copied";
      btn.appendChild(popup);

      setTimeout(() => popup.remove(), 900);
    } catch (err) {
      console.error("Copy popup error:", err);
    }
  }).catch(err => {
    console.error("Copy failed:", err);
  });
}

// ADD VAULT MANUALLY
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
  await loadLocalVaults();
});
// RESTORE ALL VAULTS (button to the right of ADD)
document.getElementById("restoreVaultsBtn")
        .addEventListener("click", restoreAllVaults);

// UTILITIES
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
