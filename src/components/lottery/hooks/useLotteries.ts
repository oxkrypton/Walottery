import { useCallback, useEffect, useMemo, useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['lotteries', API_BASE], []);

  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const syncLottery = useMutation({
    mutationFn: async (lotteryId: string) => {
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
    },
  });

  const loadLotteryMutation = useMutation({
    mutationFn: async (objectId: string) => {
      const result = await suiClient.getObject({
        id: objectId,
        options: {
          showContent: true,
        },
      });
      return parseLotteryResponse(result);
    },
    onSuccess: (parsed) => {
      if (!parsed) {
        setError('Unable to parse lottery data.');
        return;
      }

      queryClient.setQueryData<LotteryCard[]>(queryKey, (prev) => {
        const items = prev ?? [];
        return [parsed, ...items.filter((item) => item.id !== parsed.id)];
      });
      syncLottery.mutate(parsed.id);
    },
    onError: (loadError) => {
      console.error('Failed to load lottery object', loadError);
      setError(`Failed to load lottery.`);
    },
  });

  const lotteriesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<LotteryCard[]> => {
      const response = await fetch(`${API_BASE}/lotteries`);
      if (!response.ok) {
        throw new Error(`Failed to fetch lotteries: ${response.status}`);
      }
      const rows = (await response.json().catch(() => [])) as any[];
      const ids = rows.map((row) => row?.lottery_id).filter(Boolean) as string[];
      if (!ids.length) return [];

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const object = await suiClient.getObject({
              id,
              options: {
                showContent: true,
              },
            });
            return parseLotteryResponse(object);
          } catch (err) {
            console.warn(`Failed to load lottery ${id}`, err);
            return null;
          }
        }),
      );

      return results.filter((item): item is LotteryCard => Boolean(item));
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!lotteriesQuery.isError) return;
    setError((prev) => {
      if (prev) return prev;
      const queryError = lotteriesQuery.error;
      return queryError instanceof Error ? queryError.message : 'Failed to load lotteries from server.';
    });
  }, [lotteriesQuery.isError, lotteriesQuery.error]);

  const loadLottery = useCallback(
    async (objectId: string) => {
      setError(null);
      await loadLotteryMutation.mutateAsync(objectId);
    },
    [loadLotteryMutation],
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
            queryClient.setQueryData<LotteryCard[]>(queryKey, (prev) => {
              const items = prev ?? [];
              return items.map((lottery) => {
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
              });
            });
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

  const lotteries = lotteriesQuery.data ?? [];

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
