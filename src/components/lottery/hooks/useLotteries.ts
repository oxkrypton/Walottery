import { useCallback, useEffect, useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import type { LotteryCard } from '../types';
import { parseLotteryResponse } from '../utils';

export const CLOCK_ID = '0x6';
export const DEFAULT_PACKAGE_ID =
  '0x8415c40c9fde9027e289eff2943a360b9df8792217cbf7ecdb4667583b586f8d';
const API_BASE = import.meta.env.VITE_LOTTERY_API_URL || 'http://localhost:4000';

export function useLotteries() {
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? null;
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();

  const [lotteries, setLotteries] = useState<LotteryCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const syncLottery = useCallback(async (lotteryId: string) => {
    try {
      await fetch(`${API_BASE}/lotteries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lotteryId }),
      });
    } catch (err) {
      console.warn('Failed to sync lottery with backend', err);
    }
  }, []);

  const loadLottery = useCallback(
    async (objectId: string) => {
      try {
        setError(null);
        const result = await suiClient.getObject({
          id: objectId,
          options: {
            showContent: true,
          },
        });
        const parsed = parseLotteryResponse(result);
        if (parsed) {
          setLotteries((prev) => [parsed, ...prev.filter((item) => item.id !== parsed.id)]);
          syncLottery(parsed.id);
        } else {
          setError(`Unable to parse lottery data for object ${objectId}.`);
        }
      } catch (loadError) {
        console.error('Failed to load lottery object', loadError);
        setError(`Failed to load lottery ${objectId}.`);
      }
    },
    [suiClient, syncLottery],
  );

  const handleLotteryCreated = useCallback(
    (objectId: string) => {
      loadLottery(objectId);
    },
    [loadLottery],
  );

  const joinLottery = useCallback(
    (lotteryId: string) => {
      if (!currentAccount) return;
      const packageId = import.meta.env.VITE_LOTTERY_PACKAGE_ID ?? DEFAULT_PACKAGE_ID;
      setJoiningId(lotteryId);

      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::lottery_participation::join`,
        arguments: [tx.object(lotteryId), tx.object(CLOCK_ID)],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            loadLottery(lotteryId);
          },
          onError: (err) => {
            console.error('Failed to join lottery', err);
            setError(`Failed to join lottery: ${err instanceof Error ? err.message : 'Unknown error'}`);
          },
          onSettled: () => {
            setJoiningId(null);
          },
        },
      );
    },
    [currentAccount, loadLottery, signAndExecute],
  );

  const claimLottery = useCallback(
    (lotteryId: string, sealId: Uint8Array, encryptedShippingInfo: Uint8Array) => {
      if (!currentAccount) return;
      const packageId = import.meta.env.VITE_LOTTERY_PACKAGE_ID ?? DEFAULT_PACKAGE_ID;
      const winnerAddress = currentAccount.address.toLowerCase();
      setClaimingId(lotteryId);

      const tx = new Transaction();
      tx.moveCall({
        target: `${packageId}::lottery_participation::claim`,
        arguments: [
          tx.object(lotteryId),
          tx.pure.vector('u8', Array.from(sealId)),
          tx.pure.vector('u8', Array.from(encryptedShippingInfo)),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            setLotteries((prev) =>
              prev.map((lottery) => {
                if (lottery.id !== lotteryId) return lottery;
                const winnerIndex = lottery.winners?.findIndex(
                  (addr) => addr.toLowerCase() === winnerAddress,
                );
                if (winnerIndex === undefined || winnerIndex < 0) return lottery;
                const updatedClaimed = lottery.claimed
                  ? [...lottery.claimed]
                  : new Array(lottery.winners?.length ?? 0).fill(false);
                updatedClaimed[winnerIndex] = true;
                return {
                  ...lottery,
                  claimed: updatedClaimed,
                };
              }),
            );
            loadLottery(lotteryId);
          },
          onError: (err) => {
            console.error('Failed to claim lottery prize', err);
            setError(`Failed to claim prize: ${err instanceof Error ? err.message : 'Unknown error'}`);
          },
          onSettled: () => {
            setClaimingId(null);
          },
        },
      );
    },
    [currentAccount, loadLottery, signAndExecute],
  );

  useEffect(() => {
    async function fetchLotteries() {
      try {
        const response = await fetch(`${API_BASE}/lotteries`);
        if (!response.ok) {
          throw new Error(`Failed to fetch lotteries: ${response.status}`);
        }
        const rows = await response.json();
        for (const row of rows) {
          if (row.lottery_id) {
            await loadLottery(row.lottery_id);
          }
        }
      } catch (err) {
        console.error('Failed to load lotteries from server', err);
        setError('Failed to load lotteries from server.');
      }
    }

    fetchLotteries();
  }, [loadLottery]);

  return {
    lotteries,
    error,
    setError,
    joiningId,
    claimingId,
    currentAddress,
    canJoin: Boolean(currentAccount),
    loadLottery,
    handleLotteryCreated,
    joinLottery,
    claimLottery,
  };
}
