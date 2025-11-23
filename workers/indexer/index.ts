import {
  createSupabaseClient,
  createSuiClient,
  upsertLotteryRecord,
  type WorkerEnv,
} from '../shared.ts';
import type { EventId } from '@mysten/sui/client';

interface Env extends WorkerEnv {
  LOTTERY_INDEXER_PAGES_PER_RUN?: string;
  LOTTERY_INDEXER_BATCH_SIZE?: string;
}

const getNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function getLastCursor(
  client: ReturnType<typeof createSupabaseClient>,
): Promise<EventId | null> {
  const { data, error } = await client
    .from('lottery_indexer_state')
    .select('cursor')
    .eq('singleton', true)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load cursor: ${error.message}`);
  }
  return (data?.cursor as EventId | null) ?? null;
}

async function saveCursor(client: ReturnType<typeof createSupabaseClient>, cursor: EventId) {
  const { error } = await client
    .from('lottery_indexer_state')
    .upsert({ singleton: true, cursor }, { onConflict: 'singleton' });
  if (error) {
    throw new Error(`Failed to save cursor: ${error.message}`);
  }
}

async function upsertLotteryEvent(
  client: ReturnType<typeof createSupabaseClient>,
  event: any,
  state: { packageId: string },
) {
  const parsed = event.parsedJson || {};
  const lotteryId = parsed.lottery_id;
  if (!lotteryId) {
    console.warn('LotteryCreated missing lottery_id', event);
    return;
  }

  const deadlineMs = Number(parsed.deadline_ms ?? 0);
  const totalPrizeUnits = Number(parsed.total_prize_units ?? 0);
  const creator = parsed.creator ?? '0x0';
  const eventSeq = Number(event.id?.eventSeq ?? event.id?.seqNumber ?? event.eventSeq ?? 0);
  const digest = event.id?.txDigest ?? event.transactionDigest ?? event.txDigest ?? '';
  const timestampMs = Number(event.timestampMs ?? Date.now());
  const timestamp = new Date(timestampMs).toISOString();

  await upsertLotteryRecord(client, {
    lottery_id: lotteryId,
    creator,
    deadline_ms: deadlineMs,
    total_prize_units: totalPrizeUnits,
    tx_digest: digest,
    event_seq: eventSeq,
    emitted_at: timestamp,
    raw_event: event,
  });

  console.log(
    `Stored lottery ${lotteryId} from tx ${digest || 'n/a'} in package ${state.packageId}`,
  );
}

async function runIndexer(env: Env) {
  const supabase = createSupabaseClient(env);
  const suiClient = createSuiClient(env);
  const packageId = env.WALOTTERY_PACKAGE_ID;
  if (!packageId) {
    throw new Error('Missing WALOTTERY_PACKAGE_ID');
  }

  const eventType = `${packageId}::lottery_creation::LotteryCreated`;
  const batchSize = getNumber(env.LOTTERY_INDEXER_BATCH_SIZE, 50);
  const maxPages = getNumber(env.LOTTERY_INDEXER_PAGES_PER_RUN, 10);

  let cursor = await getLastCursor(supabase);
  let pagesProcessed = 0;
  let continuePaging = true;

  while (continuePaging && pagesProcessed < maxPages) {
    const response = await suiClient.queryEvents({
      query: { MoveEventType: eventType },
      cursor: cursor ?? undefined,
      limit: batchSize,
      order: 'ascending',
    });

    if (response.data.length === 0) {
      break;
    }

    for (const event of response.data) {
      await upsertLotteryEvent(supabase, event, { packageId });
      if (event.id) {
        cursor = event.id;
        await saveCursor(supabase, event.id);
      }
    }

    pagesProcessed += 1;
    continuePaging = response.hasNextPage ?? false;
    if (!continuePaging) {
      break;
    }
  }
}

export default {
  async scheduled(_: unknown, env: Env) {
    await runIndexer(env);
  },
};
