PulseLocker — Immutable Price + Time-Based Vaults for PulseChain



PulseLocker provides fully on-chain, single-use vaults for PulseChain tokens.

Each vault unlocks permanently when either:



A user-defined USD price target is reached



A user-defined time unlock occurs (guaranteed fallback)



All logic is enforced through immutable smart contracts with no admin keys, ensuring permanent, trustless behavior.



✨ Features

🔒 Immutable Vaults



Lock PLS, pDAI, or HEX



Configure a USD price threshold and a backup time unlock



Deposit tokens at any time after creation



Withdraw once when conditions are met



After withdrawal, the vault is considered finished



Late, accidental deposits can still be safely retrieved via rescue function



💵 USD-Based Price Thresholds



Vaults compute price directly from PulseX liquidity:



Dual price-feeds (primary + backup)



Automatic feed selection based on USD-side liquidity depth



Manipulation-resistant, oracle-free, fully on-chain logic



⏱ Guaranteed Time Unlock



If price feeds fail, the vault will still unlock when the time threshold is reached.



🧰 Post-Withdrawal Rescue



After the main withdrawal, any new tokens sent to the vault can be safely rescued by the owner.



📦 Components



PulseLocker consists of:



A factory contract that deploys vaults



An immutable vault implementation instantiated by the factory



A lightweight frontend for interacting with deployed vaults



🔐 Smart Contract Architecture

VaultFactory (the only contract deployed directly)



Responsible for:



Creating new vault instances



Defining asset parameters (tokens, decimals, price-feed pairs)



Maintaining per-owner vault registry via getVaultsByOwner()



Exposing stable interfaces used by the frontend



The factory contains no admin keys or privileged pathways.



GenericPriceTimeVault (vault implementation)



This contract contains the actual vault logic. It is:



Instantiated by the factory (not deployed directly)



Immutable and self-contained once created



Responsible for:



USD-price threshold unlock



Time unlock fallback



One-time withdrawal



Post-withdrawal rescue mechanism



Each vault created by the factory is its own permanent contract instance.



🖥 Frontend Behavior



The frontend is a self-contained single-page app:



Core Features



Connect PulseChain wallet



Create new vaults



Add vault address manually



Restore previously created vaults



Live display of:



Current USD price



Price-feed validity



Liquidity depth



Threshold progress (pie chart)



Time progress



Locked token amount



Unlock eligibility



Withdraw or rescue tokens



Collapse/expand vaults



Reorder vault cards



Remove vaults from UI



Light/dark theme toggle



Runs locally by opening index.html — no build tools required.



🧩 Price Calculation Logic



Vaults use PulseX reserves directly:



Load reserve data from both primary and backup trading pairs



Validate feed availability



Normalize by USD-side liquidity



Choose the feed with the deeper normalized liquidity



If both feeds fail → only time unlock applies



This mirrors the logic implemented in the on-chain vaults.



🧱 Frontend Architecture Notes

Local Vault Registry



Vaults are stored per wallet using:



generic-vaults-<walletAddress>





Supports:



Persistent vault list



Custom ordering



Collapse state memory



Add/remove without chain interaction



Live UI Refresh



The UI periodically updates:



Price



Liquidity



Unlock state



Time progress



Balance changes



RPC Resilience



To avoid RPC failures (especially on mobile wallets):



All blockchain reads use a retry wrapper (safeCall())



Multiple public PulseChain RPCs are used via a fallback provider cluster



This provides stable updates even under poor network conditions.



🔐 Security \& Trust Model



PulseLocker intentionally avoids:



Admin keys



Upgradable contracts



Proxies



Off-chain oracles



Multi-cycle or relock behavior



All logic is permanently encoded at deployment time.



🧠 Design Principles



Predictable — immutable behavior on-chain



Simple — one vault = one lifecycle



Transparent — all logic visible on-chain



Resilient — dual price feeds + time fallback



Lightweight — zero dependencies, no build step



📁 Repository Structure

/contracts

&nbsp;   VaultFactory.sol

&nbsp;   GenericPriceTimeVault.sol



/frontend

&nbsp;   index.html

&nbsp;   app.js

&nbsp;   assets/



/README.md

/LICENSE



🚀 Running Locally



Clone the repository



Open frontend/index.html in a browser



Connect a PulseChain wallet



Create or load vaults



No bundler, no CLI tools, no dependencies.



🤝 Contributing



Issues and pull requests are welcome.

Contributions should preserve the project’s principles of immutability, simplicity, and clarity.



📫 Contact



For questions, ideas, or discussion, open an Issue on GitHub or reach out through the project’s community channels.

