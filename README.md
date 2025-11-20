# Walottery

Walottery is split into two parts:

- `move/` &mdash; the on-chain Move modules (`walottery::lottery_state`,
  `lottery_creation`, `lottery_participation`, `lottery_seal`) plus unit tests.
- `src/` &mdash; a React + Vite frontend scaffold created with
  `npm create @mysten/dapp`. The UI is intentionally minimal: it wires up
  `@mysten/dapp-kit`, wallet connection, Radix UI primitives, and three empty
  sections where the actual lottery experience can be implemented.

The repo already works with the new folder structure: running `sui move test`
from `move/` validates every module and the seal/claim/participation suites.
The frontend can be iterated independently without touching the Move sources.

## Requirements

- Node.js 18+ with npm (comes with `npm create @mysten/dapp`)
- Sui CLI for compiling / testing / publishing Move contracts

## Move workflows

```bash
cd move
sui move test            # run all unit tests
sui client publish --gas-budget 100000000   # publish when ready
```

After publishing, record your package IDs and object IDs somewhere safe. The
frontend exposes `src/networkConfig.ts` where you can fill in
`lotteryPackageId` per network when it is time to call the contracts.

## Frontend workflows

```bash
npm install        # install dependencies (React, Vite, dapp-kit, Radix UI…)
npm run dev        # start the Vite dev server at http://localhost:5173
npm run build      # type-check + create a production build in dist/
```

`src/App.tsx` only renders wallet status and placeholder sections. Hook your
components into those sections (or replace them entirely) when you begin calling
the Move contracts. The provider stack in `src/main.tsx` already supplies
dapp-kit’s `SuiClientProvider`, `WalletProvider`, and TanStack Query so that all
future hooks/components share the same configuration.

## Repository layout

```
.
├── move/               # Move code and tests
├── src/                # React/Vite frontend scaffold (no business logic yet)
├── package.json        # npm scripts: dev, build, lint, preview
└── README.md
```

This setup keeps the Move contracts self-contained while giving the frontend a
ready-to-use TypeScript baseline that speaks Sui wallets from day one.
