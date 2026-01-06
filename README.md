# Wordle Blockchain

A React + Hardhat project for learning blockchain development.

## Prerequisites

- Node.js 18+
- MetaMask browser extension

## Installation

```bash
npm install
```

## Development Workflow

### Terminal 1: Start Local Blockchain

```bash
npx hardhat node
```

This starts a local Ethereum node at `http://127.0.0.1:8545` with 20 test accounts, each with 10,000 ETH.

### Terminal 2: Compile and Deploy Contract

```bash
npx hardhat compile
npx hardhat run scripts/deploy.cjs --network localhost
```

The deploy script automatically updates `src/contracts/Greeter.ts` with the contract address and ABI.

### Terminal 3: Start React App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## MetaMask Setup

### Add Hardhat Network

1. Open MetaMask
2. Click network dropdown (top left)
3. Click "Add network" then "Add a network manually"
4. Enter:
   - Network Name: `Hardhat`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
5. Click Save

### Import Test Account

1. Click your account icon in MetaMask
2. Click "Add account or hardware wallet"
3. Click "Import account"
4. Paste private key:
   ```
   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
5. Click Import

You now have an account with 10,000 test ETH.

## Project Structure

```
contracts/          Solidity smart contracts
scripts/            Deployment scripts
src/
  contracts/        Auto-generated contract ABIs
  App.tsx           React frontend
  wagmi.ts          Blockchain connection config
```

## Commands

| Command | Description |
|---------|-------------|
| `npx hardhat node` | Start local blockchain |
| `npx hardhat compile` | Compile contracts |
| `npx hardhat run scripts/deploy.cjs --network localhost` | Deploy to local |
| `npm run dev` | Start React dev server |

## Troubleshooting

### MetaMask shows $0

This is normal. MetaMask can't fetch USD prices for test networks. Your ETH balance is still there.

### Transaction stuck or fails

1. In MetaMask, go to Settings > Advanced
2. Click "Clear activity tab data"
3. Try the transaction again

This happens when you restart the Hardhat node but MetaMask has cached old nonces.

### Contract not found

Re-deploy the contract after restarting Hardhat node:

```bash
npx hardhat run scripts/deploy.cjs --network localhost
```
