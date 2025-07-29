# BSV Token CLI Tools

A command-line interface for minting, sending, receiving, and checking balances of BSV tokens using the BSV SDK.

## Prerequisites

- Node.js installed
- BSV wallet configured
- `tsx` package for running TypeScript files

## Installation

Install dependencies:
```bash
npm install
```

## Usage

The tools should be used in the following sequence:

### 1. Mint Tokens

First, mint new tokens:

```bash
npx tsx src/mint.ts
```

This will create new tokens and output the transaction details including the asset ID that will be used for subsequent operations.

### 2. Send Tokens

Send tokens to another wallet by providing the recipient's public key and the amount:

```bash
npx tsx src/send.ts <recipient_public_key> <amount>
```

**Example:**
```bash
npx tsx src/send.ts 028656505ffad07975a839a4cdf13c71318e5e7dd0e98db485137f249d9afddeff 123
```

This will transfer the specified amount of tokens from your wallet to the recipient's public key.

### 3. Switch Wallet Profile

**Important:** Before receiving tokens or checking balance, you need to switch to a different wallet profile to simulate receiving tokens from another wallet.

Switch your wallet configuration or profile to the recipient wallet before proceeding to the next steps.

### 4. Receive Tokens

Receive tokens that were sent:

```bash
npx tsx src/receive.ts
```

This will process incoming token transfers to your current wallet.

### 5. Check Balance

Finally, check your token balance:

```bash
npx tsx src/balance.ts
```

This will display the current token balance in your wallet.

## Workflow Summary

The complete workflow is:

1. `npx tsx src/mint.ts` - Create new tokens
2. `npx tsx src/send.ts <recipient_public_key> <amount>` - Send tokens to another wallet
3. **Switch wallet profile** - Change to recipient wallet
4. `npx tsx src/receive.ts` - Receive the sent tokens
5. `npx tsx src/balance.ts` - Check the updated balance

## Configuration

Make sure your wallet configuration is properly set up in the `config/` directory before running these commands.

## Dependencies

- `@bsv/sdk` - BSV Software Development Kit
- `@bsv/message-box-client` - Message box client for BSV

## Notes

- Each script should be run in sequence as they depend on the state created by previous operations
- The wallet profile switch between send and receive operations is crucial for proper token transfer simulation
- Make sure your BSV wallet has sufficient funds for transaction fees
