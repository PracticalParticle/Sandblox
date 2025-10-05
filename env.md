# App Metadata
VITE_APP_NAME=SandBlox
VITE_APP_DESCRIPTION=Sandbox for Blox operations
VITE_APP_URL=http://localhost:5173

# WalletConnect (Required for RainbowKit modal; leave empty to disable WalletConnect)
VITE_WALLET_CONNECT_PROJECT_ID=

# Local Devnet (Used for local development)
VITE_DEVNET_RPC_URL=http://127.0.0.1:8545
VITE_DEVNET_CHAIN_ID=1337
VITE_DEVNET_NAME=Local Devnet
# Optional explorer URL for your local chain
VITE_DEVNET_EXPLORER_URL=

# Sepolia (Optional but recommended to avoid strict public RPC rate limits)
# Provide your own provider URL (Infura/Alchemy/DRPC/etc.) to reduce 429 errors
# Examples:
#   https://sepolia.infura.io/v3/<YOUR_KEY>
#   https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>
VITE_SEPOLIA_RPC_URL=
VITE_SEPOLIA_CHAIN_ID=11155111
VITE_SEPOLIA_NAME=Sepolia
VITE_SEPOLIA_EXPLORER_URL=https://sepolia.etherscan.io

# Safe (Optional)
# API key for Safe services if used by your setup
VITE_SAFE_API_KEY=

# Content Security Policy (Optional)
# This feeds %VITE_CSP_SCRIPT_SRC% in index.html during build. Leave empty to inject nothing.
# Example (uncomment to allow wasm eval in dev):
# VITE_CSP_SCRIPT_SRC='"wasm-unsafe-eval" "unsafe-eval"'
VITE_CSP_SCRIPT_SRC=
