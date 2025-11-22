// ================================
// app.js (FINAL with HEX display fix) - PART 1
// ================================
console.log("Generic vault app.js loaded (HEX display fixed).");

if (!window.ethers) {
  alert("Ethers failed to load.");
  throw new Error("Ethers missing");
}
const ethersLib = window.ethers;

// -------------------------------
// CONFIG
// -------------------------------
const FACTORY_ADDRESS = "0xD243c80BD1d29FEf078c7199bdA48750F5510B61".toLowerCase(); // <--- PUT V4/Vx FACTORY HERE

// Known tokens & PulseX pairs
const ADDR = {
  DAI:  "0xefD766cCb38EaF1dfd701853BFCe31359239F305".toLowerCase(),
  WPLS: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27".toLowerCase(),
  PDAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F".toLowerCase(),
  HEX:  "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39".toLowerCase(),

  // Correct PulseX pairs:
  PLS_DAI_PAIR:  "0x146E1f1e060e5b5016Db0D118D2C5a11A240ae32".toLowerCase(),  // WPLS/DAI (V2)
  PDAI_DAI_PAIR: "0xfC64556FAA683e6087F425819C7Ca3C558e13aC1".toLowerCase(),  // pDAI/DAI (V2)
  HEX_DAI_PAIR:  "0x6F1747370B1CAcb911ad6D4477b718633DB328c8".toLowerCase()   // HEX/DAI (V1)
};

// -------------------------------
// Asset registry
// -------------------------------
const ASSETS = {
  PLS: {
    key: ethersLib.utils.keccak256(ethersLib.utils.toUtf8Bytes("PLS")),
    label: "PLS",
    isNative: true,
    lockToken: ADDR.WPLS,
    quoteToken: ADDR.DAI,
    pair: ADDR.PLS_DAI_PAIR
  },
  PDAI: {
    key: ethersLib.utils.keccak256(ethersLib.utils.toUtf8Bytes("PDAI")),
    label: "pDAI",
    isNative: false,
    lockToken: ADDR.PDAI,
    quoteToken: ADDR.DAI,
    pair: ADDR.PDAI_DAI_PAIR
  },
  HEX: {
    key: ethersLib.utils.keccak256(ethersLib.utils.toUtf8Bytes("HEX")),
    label: "HEX",
    isNative: false,
    lockToken: ADDR.HEX,
    quoteToken: ADDR.DAI,
    pair: ADDR.HEX_DAI_PAIR
  }
};

// -------------------------------
// ABIs
// -------------------------------
const factoryAbi = [
  "event VaultCreated(address indexed owner, address vault, bytes32 assetKey, uint256 priceThreshold1e18, uint256 unlockTime)",
  "function createVault(bytes32 assetKey, uint256 priceThreshold1e18, uint256 unlockTime) external returns (address)"
];

const vaultAbi = [
  "function owner() view returns (address)",
  "function lockToken() view returns (address)",
  "function quoteToken() view returns (address)",
  "function pair() view returns (address)",
  "function isNative() view returns (bool)",
  "function lockTokenIsToken0() view returns (bool)",

  "function priceThreshold() view returns (uint256)",
  "function unlockTime() view returns (uint256)",
  "function startTime() view returns (uint256)",
  "function withdrawn() view returns (bool)",

  "function currentPrice1e18() view returns (uint256)",
  "function priceConditionMet() view returns (bool)",
  "function timeConditionMet() view returns (bool)",
  "function canWithdraw() view returns (bool)",
  "function secondsUntilTimeUnlock() view returns (uint256)",

  "function withdraw() external"
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

// -------------------------------
// STATE
// -------------------------------
let provider, signer, userAddress;
let factoryContract;
let locks = [];
let countdownInterval;

// -------------------------------
// DOM
// -------------------------------
const connectBtn       = document.getElementById("connectBtn");
const walletSpan       = document.getElementById("walletAddress");
const networkInfo      = document.getElementById("networkInfo");

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

    const net = await provider.getNetwork();
    walletSpan.textContent = userAddress;
    networkInfo.textContent = `Connected (chainId: ${net.chainId})`;

    factoryContract = new ethersLib.Contract(FACTORY_ADDRESS, factoryAbi, signer);

    await refreshGlobalPrice();
    await loadLocalVaults();

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      if (locks.length) renderLocks();
    }, 1000);

  } catch (err) {
    alert("Connection failed: " + err.message);
    console.error(err);
  }
}
connectBtn.addEventListener("click", connect);

// -------------------------------
// GLOBAL PRICE FEED
// -------------------------------
async function refreshGlobalPrice() {
  try {
    const assetCode = assetSelect.value;
    const cfg = ASSETS[assetCode];
    if (!cfg) return;

    pairAddressSpan.textContent = cfg.pair;

    const pair = new ethersLib.Contract(cfg.pair, pairAbi, provider);
    const [r0, r1] = await pair.getReserves();

    if (r0.eq(0) || r1.eq(0)) {
      globalPriceDiv.textContent = "No liquidity.";
      globalPriceRaw.textContent = "";
      return;
    }

    const token0 = (await pair.token0()).toLowerCase();
    const token1 = (await pair.token1()).toLowerCase();

    let lockRes, quoteRes;

    if (token0 === cfg.lockToken && token1 === cfg.quoteToken) {
      lockRes = r0;
      quoteRes = r1;
    } else if (token1 === cfg.lockToken && token0 === cfg.quoteToken) {
      lockRes = r1;
      quoteRes = r0;
    } else {
      globalPriceDiv.textContent = "Pair tokens mismatch.";
      globalPriceRaw.textContent = "";
      return;
    }

    // Raw on-chain price (matches vault logic):
    // price1e18 = (quoteRes * 1e18) / lockRes
    const priceBN = quoteRes.mul(ethersLib.constants.WeiPerEther).div(lockRes);

    // DISPLAY DECIMALS:
    // - PLS & pDAI: 18/18 ⇒ 18
    // - HEX: 8/18 ⇒ priceBN / 1e10 ⇒ 28 decimals for human display
    const displayDecimals = (assetCode === "HEX") ? 28 : 18;

    const float = Number(ethersLib.utils.formatUnits(priceBN, displayDecimals));

    // Optional: show which PulseX version
    const sourceLabel =
      (cfg.pair === ADDR.PLS_DAI_PAIR || cfg.pair === ADDR.PDAI_DAI_PAIR)
        ? "PulseX V2 pool"
        : "PulseX V1 pool";

    globalPriceDiv.textContent =
      `Source: ${sourceLabel} — 1 ${cfg.label} ≈ ${float.toFixed(6)} DAI`;

    globalPriceRaw.textContent = `raw 1e18: ${priceBN.toString()}`;

  } catch (err) {
    globalPriceDiv.textContent = "Price error.";
    globalPriceRaw.textContent = "";
    console.error("Global price error:", err);
  }
}

setInterval(refreshGlobalPrice, 15000);
assetSelect.addEventListener("change", refreshGlobalPrice);

// PART 1 END
// ================================
// app.js (FINAL with HEX display fix) - PART 2
// ================================

// -------------------------------
// LOCAL STORAGE HELPERS
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
    if (!priceStr) throw new Error("Enter a target price");

    // NOTE: We leave threshold parsing as-is, since you said
    // the HEX target input & "Target:" card display are already correct.
    const th1e18 = ethersLib.utils.parseUnits(priceStr, 18);

    const dt = unlockDateInput.value.trim();
    const ts = Date.parse(dt);
    if (isNaN(ts)) throw new Error("Invalid datetime");
    const unlockTime = Math.floor(ts / 1000);

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
      } catch {
        // ignore non-matching logs
      }
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

// -------------------------------
// LOAD LOCAL VAULTS
// -------------------------------
async function loadLocalVaults() {
  const list = getLocalVaults();
  if (!list.length) {
    locksContainer.textContent = "No locks found.";
    locks = [];
    return;
  }

  locksContainer.textContent = "Loading vaults...";
  const results = [];

  for (const addr of list) {
    try {
      const vault = new ethersLib.Contract(addr, vaultAbi, provider);
      const [
        owner,
        lockToken,
        quoteToken,
        pairAddr,
        isNative,
        threshold,
        unlockTime,
        startTime,
        withdrawn
      ] = await Promise.all([
        vault.owner(),
        vault.lockToken(),
        vault.quoteToken(),
        vault.pair(),
        vault.isNative(),
        vault.priceThreshold(),
        vault.unlockTime(),
        vault.startTime(),
        vault.withdrawn()
      ]);

      const assetLabel = detectAssetLabel(lockToken.toLowerCase(), isNative);

      // Locked balance
      let balanceBN;
      if (isNative) {
        balanceBN = await provider.getBalance(addr);
      } else {
        const erc20 = new ethersLib.Contract(lockToken, erc20Abi, provider);
        balanceBN = await erc20.balanceOf(addr);
      }

      // Try reading current price but don't fail entire load if it reverts
      let currentPriceBN = ethersLib.constants.Zero;
      try {
        currentPriceBN = await vault.currentPrice1e18();
      } catch {
        // no liquidity or error; keep as zero
      }

      // canWithdraw (safe path)
      let canWithdraw = false;
      try {
        canWithdraw = await vault.canWithdraw();
      } catch {
        canWithdraw = false;
      }

      results.push({
        address: addr.toLowerCase(),
        assetLabel,
        lockToken: lockToken.toLowerCase(),
        quoteToken: quoteToken.toLowerCase(),
        pair: pairAddr.toLowerCase(),
        isNative,
        threshold,
        unlockTime: unlockTime.toNumber(),
        startTime: startTime.toNumber(),
        withdrawn,
        balanceBN,
        currentPriceBN,
        canWithdraw
      });

    } catch (err) {
      console.error("Vault load error:", addr, err);
      // Keep a removable error card
      results.push({
        address: addr.toLowerCase(),
        error: true
      });
    }
  }

  locks = results;
  renderLocks();
}

// Detect asset label from lockToken + isNative
function detectAssetLabel(lockTokenAddr, isNative) {
  if (isNative) return "PLS";
  if (lockTokenAddr === ADDR.PDAI) return "pDAI";
  if (lockTokenAddr === ADDR.HEX) return "HEX";
  return "Unknown";
}

// -------------------------------
// RENDER LOCK CARDS
// -------------------------------
function renderLocks() {
  if (!locks.length) {
    locksContainer.textContent = "No locks found.";
    return;
  }

  const nowTs = Math.floor(Date.now() / 1000);

  locksContainer.innerHTML = locks.map(lock => {

    // Error card (removable)
    if (lock.error) {
      return `
        <div class="card vault-card">
          <div class="vault-asset-label">UNKNOWN</div>
          <div class="small">Error loading vault at ${lock.address}</div>
          <button onclick="removeVault('${lock.address}')"
                  style="margin-top:10px;background:#b91c1c;">
            Remove
          </button>
        </div>
      `;
    }

    const assetLabel = lock.assetLabel;

    const thresholdFloat = parseFloat(
      ethersLib.utils.formatUnits(lock.threshold, 18)
    );

    // DISPLAY DECIMALS FOR CURRENT PRICE (match global feed):
    const priceDisplayDecimals = (assetLabel === "HEX") ? 28 : 18;

    const currentPriceFloat = lock.currentPriceBN.gt(0)
      ? parseFloat(ethersLib.utils.formatUnits(lock.currentPriceBN, priceDisplayDecimals))
      : 0;

    const balanceFloat = parseFloat(
      ethersLib.utils.formatUnits(lock.balanceBN, 18)
    );

    const withdrawnTag = lock.withdrawn;
    const canWithdraw = lock.canWithdraw && !lock.withdrawn;

    // Price goal percentage (uses raw 1e18 values; unchanged)
    let priceGoalPct = 0;
    if (lock.threshold.gt(0) && lock.currentPriceBN.gt(0)) {
      const pctBN = lock.currentPriceBN.mul(10000).div(lock.threshold); // basis points
      priceGoalPct = pctBN.toNumber() / 100; // 2 decimals
    }
    if (priceGoalPct > 100) priceGoalPct = 100;
    if (priceGoalPct < 0)   priceGoalPct = 0;

    if (canWithdraw && lock.currentPriceBN.gte(lock.threshold)) {
      priceGoalPct = 100;
    }

    // Time progress
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

    const status =
      withdrawnTag
        ? '<span class="tag status-warn">WITHDRAWN</span>'
        : canWithdraw
        ? '<span class="tag status-ok">UNLOCKABLE</span>'
        : '<span class="tag status-bad">LOCKED</span>';

    const timeBarStyle = `width:${timeGoalPct.toFixed(1)}%;`;

    return `
      <div class="card vault-card ${canWithdraw ? 'vault-unlockable' : ''}">
        <div class="vault-asset-label">${assetLabel} VAULT</div>

        <!-- Address + copy -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;width:100%;max-width:450px;">
          <input class="mono"
            value="${lock.address}"
            readonly
            style="
              background:#020617;
              color:#a5b4fc;
              border:1px solid #4b5563;
              width:100%;
              padding:4px;
              border-radius:6px;
            " />
          <div class="copy-icon-btn" onclick="copyAddr('${lock.address}')">
            <svg viewBox="0 0 24 24">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 
                       0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 
                       2-.9 2-2V7c0-1.1-.9-2-2-2zm0 
                       16H8V7h11v14z"/>
            </svg>
          </div>
        </div>

        ${status}

        <!-- Metrics & Price + Time Goals -->
        <div style="
          display:flex;
          flex-direction:row;
          align-items:flex-start;
          gap:16px;
          margin-top:10px;
          flex-wrap:nowrap;
          width:fit-content;
          max-width:100%;
        ">

          <!-- LEFT: Metrics -->
          <div style="display:flex;flex-direction:column;flex:0 1 auto;">
            <div><strong>Target:</strong> 1 ${assetLabel} ≥ ${thresholdFloat.toFixed(6)} DAI</div>
            <div><strong>Current:</strong> ${currentPriceFloat.toFixed(6)} DAI</div>
            <div><strong>Backup unlock:</strong> ${formatTimestamp(lock.unlockTime)}</div>
            <div><strong>Locked:</strong> ${balanceFloat.toFixed(4)} ${assetLabel}</div>
          </div>

          <!-- MIDDLE: Price goal pie -->
          <div class="price-goal-wrapper" style="flex:0 0 auto;margin-left:8px;">
            <div class="small" style="text-align:center;">Price goal</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <div class="price-goal-pie"
                   style="background:conic-gradient(#22c55e ${priceGoalPct}%, #020617 0);">
              </div>
              <div class="small">${priceGoalPct.toFixed(0)}%</div>
            </div>
          </div>

          <!-- RIGHT: Time goal bar -->
          <div class="time-progress-wrapper" style="flex:0 0 auto;margin-left:8px;max-width:160px;">
            <div class="small">Time goal</div>
            <div class="time-progress-bar-bg">
              <div class="time-progress-bar-fill" style="${timeBarStyle}"></div>
            </div>
            <div class="small">${timeLabel}</div>
          </div>

        </div>

        <!-- Withdraw / Remove -->
        <div style="margin-top:10px;">
          <button onclick="withdrawVault('${lock.address}')"
            ${(!canWithdraw) ? "disabled" : ""}>
            Withdraw
          </button>

          <button onclick="removeVault('${lock.address}')"
            style="margin-left:10px;background:#b91c1c;">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------
// WITHDRAW
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
    await loadLocalVaults();
  } catch (err) {
    alert("Withdraw failed: " + (err && err.message ? err.message : String(err)));
    console.error("Withdraw error:", err);
  }
}

// -------------------------------
// REMOVE VAULT FROM LOCAL LIST
// -------------------------------
function removeVault(addr) {
  const lower = addr.toLowerCase();
  const list = getLocalVaults().filter(a => a.toLowerCase() !== lower);
  localStorage.setItem(localKey(), JSON.stringify(list));
  loadLocalVaults();
}

// -------------------------------
// COPY ADDRESS
// -------------------------------
function copyAddr(addr) {
  navigator.clipboard.writeText(addr).catch(err => {
    console.error("Copy failed:", err);
  });
}

// -------------------------------
// MANUAL ADD
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
  await loadLocalVaults();
});

// -------------------------------
// UTILITIES
// -------------------------------
function formatTimestamp(ts) {
  return new Date(ts * 1000).toLocaleString();
}

// A number-based version of countdown, for timeGoal label
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

