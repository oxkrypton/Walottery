import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createSupabaseClient, createSuiClient, unwrapVector, type WorkerEnv } from '../shared.ts';

interface Env extends WorkerEnv {
  LOTTERY_DRAW_BATCH_SIZE?: string;
}

const getNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function fetchExpiredCandidates(
  client: ReturnType<typeof createSupabaseClient>,
  limit: number,
) {
  const now = Date.now();
  const { data, error } = await client
    .from('lottery_created_events')
    .select('lottery_id, deadline_ms')
    .lte('deadline_ms', now)
    .order('deadline_ms', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list expired lotteries: ${error.message}`);
  }
  return data ?? [];
}

async function loadLotteryOnChain(suiClient: ReturnType<typeof createSuiClient>, lotteryId: string) {
  const response = await suiClient.getObject({
    id: lotteryId,
    options: {
      showContent: true,
    },
  });

  const content = response.data?.content;
  if (!content || content.dataType !== 'moveObject') {
    return null;
  }
  const fields = content.fields as any;

  const deadlineMs = Number(fields.deadline_ms ?? fields.deadline ?? 0);
  const settled = Boolean(fields.settled);
  const participants = unwrapVector(fields.participants ?? []);

  return {
    deadlineMs,
    settled,
    participantsCount: participants.length,
  };
}

async function submitDraw(
  suiClient: ReturnType<typeof createSuiClient>,
  signer: Ed25519Keypair,
  lotteryId: string,
  packageId: string,
  randomId: string,
  clockId: string,
) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::lottery_creation::draw`,
    arguments: [tx.object(lotteryId), tx.object(randomId), tx.object(clockId)],
  });

  const result = await suiClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: {
      showEffects: true,
    },
  });

  console.log(`Submitted draw for ${lotteryId} (digest ${result.digest})`);
}

async function runWatcher(env: Env) {
  const supabase = createSupabaseClient(env);
  const suiClient = createSuiClient(env);
  const packageId = env.WALOTTERY_PACKAGE_ID;
  if (!packageId) {
    throw new Error('Missing WALOTTERY_PACKAGE_ID');
  }

  const privateKey = env.LOTTERY_DRAW_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Missing LOTTERY_DRAW_PRIVATE_KEY');
  }

  const signer = Ed25519Keypair.fromSecretKey(privateKey);
  const clockId = env.SUI_CLOCK_ID ?? '0x6';
  const randomId = env.SUI_RANDOM_ID ?? '0x8';
  const batchSize = getNumber(env.LOTTERY_DRAW_BATCH_SIZE, 25);

  const candidates = await fetchExpiredCandidates(supabase, batchSize);
  if (!candidates.length) {
    console.log('No expired lotteries to settle');
    return;
  }

  for (const candidate of candidates) {
    const lotteryId = candidate.lottery_id as string;
    try {
      const state = await loadLotteryOnChain(suiClient, lotteryId);
      if (!state) {
        console.warn(`Unable to load lottery ${lotteryId}`);
        continue;
      }

      if (state.settled || state.deadlineMs > Date.now()) {
        continue;
      }

      if (state.participantsCount === 0) {
        console.warn(`Lottery ${lotteryId} has no participants, skipping draw.`);
        continue;
      }

      await submitDraw(suiClient, signer, lotteryId, packageId, randomId, clockId);
    } catch (error) {
      console.error(`Failed to process lottery ${lotteryId}`, error);
    }
  }
}

export default {
  async scheduled(_: unknown, env: Env) {
    await runWatcher(env);
  },
};
