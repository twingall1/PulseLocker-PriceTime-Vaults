# PulseLocker — Immutable Price + Time-Based Vaults for PulseChain

PulseLocker provides fully on-chain, single-use vaults for PulseChain tokens.  
Each vault unlocks permanently when **either**:

- A user-defined **USD price target** is reached  
- A user-defined **time unlock** occurs (guaranteed fallback)

All logic is enforced through immutable smart contracts with **no admin keys**, ensuring permanent, trustless behavior.

---

## Features

### Immutable Vaults
- Lock PLS, pDAI, or HEX  
- Configure a USD price threshold and a backup time unlock  
- Deposit tokens at any time after creation  
- Withdraw once when conditions are met  
- After withdrawal, the vault is permanently finished  
- Late accidental deposits can still be safely retrieved via `rescue()`  

### USD-Based Price Thresholds
Vaults compute price directly from PulseX liquidity:

- Dual price-feeds (primary & backup)  
- Automatic feed selection based on **USD-side liquidity depth**  
- Manipulation-resistant, oracle-free, fully on-chain pricing  

### Guaranteed Time Unlock
Even if all price feeds are invalid, the vault unlocks when the backup timestamp is reached.

### Post-Withdrawal Rescue
If tokens are sent to the vault after its lifecycle is finished, the owner may recover them safely.

---

## Smart Contract Architecture

PulseLocker consists of a deployable factory and an immutable vault implementation.

### VaultFactory
The only contract deployed directly. It:

- Creates new vault instances  
- Stores per-owner vault registry  
- Defines asset configurations (tokens, decimals, PulseX feed pairs)  
- Exposes `getVaultsByOwner()` for frontend restoration  

Contains no privileged functions and cannot be upgraded.

### GenericPriceTimeVault
Vault implementation contract. It:

- Is instantiated by the factory (not deployed manually)  
- Enforces USD-based price unlock  
- Enforces time-based unlock fallback  
- Allows exactly one withdrawal per vault  
- Allows rescue of accidentally sent tokens after withdrawal  
- Contains no admin keys and cannot be altered  

Each deployed vault is a fully independent, immutable contract.

---

## Frontend (Single-Page Application)

The frontend is a minimal, dependency-free SPA composed of `index.html` and `app.js`.

### Capabilities
- Connect a PulseChain wallet  
- Create new vaults  
- Add vault addresses manually  
- Restore previously created vaults  
- View real-time price, reserves, time progress, and status  
- Withdraw or rescue tokens  
- Reorder, collapse, or remove vault cards  
- Toggle light/dark theme  
- Navigate between dashboard and guide without reloading  

Open `index.html` directly in a browser to run the app.

---

## Price Calculation Details

PulseLocker uses PulseX pool reserves:

1. Reads reserves from **primary** and **backup** PulseX pairs  
2. Validates each feed  
3. Normalizes feeds by **USD-side liquidity**  
4. Chooses the feed with deeper normalized liquidity  
5. If no feed is valid, only time unlock applies  

This mirrors the logic embedded in the vault contract.

---

## Frontend Architecture Notes

### Local Vault Persistence
The frontend stores a list of the user’s vaults locally so the dashboard can
restore them automatically across sessions. This includes vault ordering and
whether each vault is collapsed or expanded. 
Supports persistent vault lists, custom ordering, and collapse state.

### Live Updates
The UI periodically updates:

- Token price  
- Liquidity data  
- Unlock eligibility  
- Time progress  
- Balance changes  

### RPC Reliability
To ensure stable behavior, especially on mobile wallets:

- All reads use a retry wrapper (`safeCall()`)  
- Multiple PulseChain RPC endpoints are used via a fallback provider cluster  

---

## Design Principles

- **Predictable** — immutable, deterministic vault behavior  
- **Simple** — one vault = one lifecycle  
- **Transparent** — logic is fully visible on-chain  
- **Resilient** — dual-feed pricing + time fallback  
- **Lightweight** — no build tools or external dependencies  

---

## Repository Structure

/contracts            # On-chain vault + factory contracts (included for completeness)
/frontend             # Lightweight SPA (index.html + app.js)
/other-assets         # Icons, logo, and miscellaneous frontend assets

README.md
LICENSE

---

## Running Locally

1. Clone the repository  
2. Open `frontend/index.html` in a browser  
3. Connect a PulseChain wallet  
4. Create or restore vaults  

No build process required.

---

### /contracts
Contains the immutable on-chain Factory and Vault implementation used by the live app.
Included in the repository for transparency and completeness — these contracts are already
verified on-chain and are not intended for redeployment.

---

## Contract Notes

- A fixed 0.5% fee is applied only on successful withdrawals.  
- This fee is sent to a hardcoded, immutable fee recipient encoded in the vault contract.  
- The fee address cannot be changed or redirected.

---

## Contributing

Issues and pull requests are welcome.  
Contributions should maintain immutability, clarity, and simplicity.

---

## Contact

For questions or discussion, use the site linked Telegram channel or Issues on GitHub
