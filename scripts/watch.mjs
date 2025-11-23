import 'dotenv/config';
import { Pool } from 'pg';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const NETWORK = process.env.SUI_NETWORK ?? 'testnet';
const RPC_URL = process.env.SUI_FULLNODE_URL ?? getFullnodeUrl(NETWORK);
const PACKAGE_ID = process.env.WALOTTERY_PACKAGE_ID;
const CLOCK_ID = process.env.SUI_CLOCK_ID ?? '0x6';
const RANDOM_ID = process.env.SUI_RANDOM_ID ?? '0x8';
const DRAW_PRIVATE_KEY = process.env.LOTTERY_DRAW_PRIVATE_KEY;
const POLL_INTERVAL_MS = Number(process.env.LOTTERY_DRAW_POLL_INTERVAL_MS ?? 60_000);
const MAX_BATCH = Number(process.env.LOTTERY_DRAW_BATCH_SIZE ?? 25);

if (!PACKAGE_ID) {
  console.error('Missing WALOTTERY_PACKAGE_ID. Set it in your environment (.env).');
  process.exit(1);
}

if (!DRAW_PRIVATE_KEY) {
  console.error('Missing LOTTERY_DRAW_PRIVATE_KEY. Provide a sui.privatekey=... string.');
  process.exit(1);
}

let signer;
try {
  signer = Ed25519Keypair.fromSecretKey(DRAW_PRIVATE_KEY);
} catch (error) {
  console.error('Failed to load LOTTERY_DRAW_PRIVATE_KEY', error);
  process.exit(1);
}
const suiClient = new SuiClient({ url: RPC_URL });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function unwrapVector(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.fields?.contents)) return value.fields.contents;
  if (Array.isArray(value?.contents)) return value.contents;
  if (Array.isArray(value?.fields)) return value.fields;
  if (Array.isArray(value?.value)) return value.value;
  return [];
}

async function fetchExpiredCandidates(limit) {
  const now = Date.now();
  const { rows } = await pool.query(
    `
      SELECT lottery_id, deadline_ms
      FROM lottery_created_events
      WHERE deadline_ms <= $1
      ORDER BY deadline_ms ASC
      LIMIT $2;
    `,
    [now, limit],
  );
  return rows;
}

async function loadLotteryOnChain(lotteryId) {
  const response = await suiClient.getObject({
    id: lotteryId,
    options: {
      showContent: true,
    },
  });

  const fields = response.data?.content?.fields;
  if (!fields) return null;

  const deadlineMs = Number(fields.deadline_ms ?? fields.deadline ?? 0);
  const settled = Boolean(fields.settled);
  const participants = unwrapVector(fields.participants ?? []);

  return {
    deadlineMs,
    settled,
    participantsCount: participants.length,
  };
}

async function submitDraw(lotteryId) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::lottery_creation::draw`,
    arguments: [tx.object(lotteryId), tx.object(RANDOM_ID), tx.object(CLOCK_ID)],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: {
      showEffects: true,
    },
  });

  console.log(`Submitted draw for ${lotteryId}. Digest: ${result.digest}`);
}

async function processBatch() {
  try {
    const candidates = await fetchExpiredCandidates(MAX_BATCH);
    if (!candidates.length) {
      return;
    }

    for (const candidate of candidates) {
      const { lottery_id: lotteryId } = candidate;
      try {
        const chainState = await loadLotteryOnChain(lotteryId);
        if (!chainState) {
          console.warn(`Unable to load lottery ${lotteryId} from chain`);
          continue;
        }

        if (chainState.settled) {
          continue;
        }

        if (chainState.deadlineMs > Date.now()) {
          continue;
        }

        if (chainState.participantsCount === 0) {
          console.warn(`Lottery ${lotteryId} has no participants, skipping draw.`);
          continue;
        }

        await submitDraw(lotteryId);
      } catch (lotteryError) {
        console.error(`Failed to handle lottery ${lotteryId}`, lotteryError);
      }
    }
  } catch (error) {
    console.error('Failed to process draw batch', error);
  }
}

async function startWatcher() {
  console.log(`Starting draw watcher on ${NETWORK} (${RPC_URL}). Polling every ${POLL_INTERVAL_MS}ms.`);
  setInterval(processBatch, POLL_INTERVAL_MS);
  await processBatch();
}

function shutdown() {
  pool.end().catch((err) => console.error('Failed to close DB pool', err));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startWatcher().catch((error) => {
  console.error('Draw watcher failed to start', error);
  process.exit(1);
});
