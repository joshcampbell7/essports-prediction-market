# Esports Prediction Market

A decentralized prediction market for esports built on Ethereum. Think Polymarket but specifically for Call of Duty, Valorant, CS2, and other esports events. Currently running on Sepolia testnet with play money.

![Esports Prediction Market Homepage](./frontend/prediction-market/public/screenshot.png)

## What I Built

I wanted to build something that combines my interest in esports with Web3, so I created a full prediction market platform. Here's what it does:
- **Create markets** on esports events (matches, transfers, tournaments, etc.)
- **Place predictions** using YES/NO outcomes with dynamic pricing
- **Track prices** in real-time as bets come in
- **View leaderboards** based on winnings and win rates
- **Manage their profile** to see all their predictions and performance

Everything runs on-chain via smart contracts, so it's fully transparent. I deployed to Sepolia testnet and set up MockUSDC tokens so people can test it without risking real money.

## Tech Stack

### Smart Contracts
- **Solidity** (^0.8.28) - Wrote the prediction market logic from scratch
- **Hardhat** - Used for compiling and deploying contracts
- **OpenZeppelin** - Leveraged their contracts for security (Ownable, ReentrancyGuard, SafeERC20)
- **Viem** - TypeScript library for interacting with Ethereum

### Frontend
- **Next.js 16** - Built the frontend with Next.js App Router
- **React 19** - All the UI components
- **TypeScript** - Kept everything type-safe
- **Wagmi** - React hooks for blockchain interactions
- **RainbowKit** - Handles wallet connections
- **Shadcn UI** - Used their component library for dialogs, cards, tables, etc.
- **Tailwind CSS** - Styled everything with Tailwind
- **Recharts** - Built the price history charts with this

### Key Features

**Smart Contract Features:**
- Virtual liquidity system - keeps pricing fair even when pools are empty
- Early resolution - markets can be resolved before the close time
- Automatic payouts - winners get their share based on bet size
- Protection against manipulation - prevents exploiting empty pools

**Frontend Features:**
- Market filtering - filter by game type (CoD, Valorant, CS2, etc.)
- Price charts - see how YES/NO prices change over time
- Admin panel - create markets and resolve them
- User profiles - track all your predictions and performance
- Leaderboard - compete based on total winnings and win rate
- Dark mode - because why not

## Project Structure

```
├── prediction-coin/          # Smart contracts
│   ├── contracts/             # Solidity files
│   ├── scripts/                # Deployment scripts
│   └── hardhat.config.ts       # Hardhat config
│
├── frontend/prediction-market/ # Next.js app
│   ├── src/
│   │   ├── app/                # Pages (home, market, profile, admin)
│   │   ├── components/         # React components
│   │   ├── lib/                # Config and utilities
│   │   └── data/               # Market types JSON
│   └── package.json
│
└── solidity/                   # Additional contracts (legacy)
```

## Getting Started

### Prerequisites
- Node.js 18+
- MetaMask (or any Web3 wallet)
- Sepolia ETH (for gas fees)
- Sepolia MockUSDC tokens

### Setup

1. **Clone the repo**
   ```bash
   git clone <your-repo-url>
   cd essports-prediction-market
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   cd frontend/prediction-market
   npm install
   
   # Smart contracts
   cd ../../prediction-coin
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env.local` in `frontend/prediction-market/`:
   ```env
   NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=0x...
   NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x...
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://...
   NEXT_PUBLIC_CHAIN_ID=11155111
   ```

4. **Run the frontend**
   ```bash
   cd frontend/prediction-market
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

### Deploying Contracts

See `prediction-coin/DEPLOYMENTS.md` for deployment instructions.

## How It Works

Pretty straightforward flow:
1. **Admins create markets** - Set up a question, pick a market type, set a close time
2. **Users place bets** - Bet YES or NO, prices update in real-time as people bet
3. **Markets get resolved** - Once the outcome is known, admins resolve it
4. **Winners claim payouts** - Get your share of the pool based on how much you bet

The pricing system uses virtual liquidity (100 USDC) to keep odds fair even when there's no real money in a pool yet. This prevents people from gaming the system.

## Market Types

The platform supports various esports categories:
- Call of Duty, Valorant, Counter Strike 2
- Transfers, Rosters, Team Performance
- Tournaments, Playoffs, Awards
- Kills, K/D, First Blood, Round Totals
- Streamer Siders, Esports Misc

Market types are configurable via `frontend/prediction-market/src/data/market-types.json`.

## Smart Contract Details

**PredictionMarket.sol** - The main contract handles:
- Creating and managing markets
- Placing bets with real-time price tracking
- Resolving markets
- Claiming payouts
- Virtual liquidity calculations

**MockUSDC.sol** - Simple ERC20 token for testing (6 decimals, matches real USDC)

## Notes

- Runs on **Sepolia testnet** - all fake money, no risk
- Uses **MockUSDC** tokens - mint as many as you need for testing
- Virtual liquidity keeps pricing fair - prevents people from manipulating empty pools
- Need a wallet connected to interact with contracts (MetaMask, etc.)

## License

MIT
