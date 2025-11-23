import { Dialog, Transition } from '@headlessui/react';
import { useSignPersonalMessage } from '@mysten/dapp-kit';
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { hasSealConfig, sealConfig } from '../../config/seal';
import type { LotteryCard } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  lottery: LotteryCard | null;
  currentAddress: string | null;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const length = clean.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export function LotteryDetailsDialog({ open, onClose, lottery, currentAddress }: Props) {
  const [decryptedInfos, setDecryptedInfos] = useState<Record<number, string>>({});
  const [decryptingIdx, setDecryptingIdx] = useState<number | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const suiClient = useMemo(() => new SuiClient({ url: sealConfig.rpcUrl }), []);
  const sealClient = useMemo(() => {
    if (!hasSealConfig()) return null;
    try {
      return new SealClient({
        suiClient,
        serverConfigs: sealConfig.serverConfigs,
        verifyKeyServers: sealConfig.verifyKeyServers,
      });
    } catch (sealError) {
      console.error('Failed to initialize Seal client', sealError);
      return null;
    }
  }, [suiClient]);
  const signPersonalMessage = useSignPersonalMessage();

  useEffect(() => {
    if (!open) {
      setDecryptedInfos({});
      setDecryptError(null);
      setDecryptingIdx(null);
    }
  }, [open]);

  if (!lottery) return null;

  const creatorAddress = lottery.creator?.toLowerCase();
  const accountAddress = currentAddress?.toLowerCase();
  const isCreator = Boolean(creatorAddress && accountAddress && creatorAddress === accountAddress);
  const winners = lottery.winners ?? [];
  const claimed = lottery.claimed ?? [];
  const shippingEncryptedInfos = lottery.shippingEncryptedInfos ?? [];

  const handleDecrypt = async (winnerIdx: number) => {
    if (!sealClient || !currentAddress) {
      setDecryptError('Seal configuration or wallet connection missing.');
      return;
    }
    if (!hasSealConfig()) {
      setDecryptError('Seal key servers are not configured.');
      return;
    }
    if (!sealConfig.packageId) {
      setDecryptError('Seal package ID is not configured.');
      return;
    }
    const encryptedHex = shippingEncryptedInfos[winnerIdx];
    if (!encryptedHex) {
      setDecryptError('No encrypted payload found for this winner.');
      return;
    }
    if (!winners[winnerIdx]) {
      setDecryptError('Winner address missing.');
      return;
    }

    setDecryptError(null);
    setDecryptingIdx(winnerIdx);

    try {
      const encryptedBytes = hexToBytes(encryptedHex);
      const winnerAddress = winners[winnerIdx].toLowerCase();
      const identityRaw = `${sealConfig.identityPrefix}:${lottery.id}:${winnerAddress}`;
      const identityBytes = textEncoder.encode(identityRaw);
      const identityHex = bytesToHex(identityBytes);

      const sessionKey = await SessionKey.create({
        address: currentAddress,
        packageId: sealConfig.packageId,
        ttlMin: 10,
        suiClient,
      });
      const personalMessage = sessionKey.getPersonalMessage();
      const { signature } = await signPersonalMessage.mutateAsync({ message: personalMessage });
      await sessionKey.setPersonalMessageSignature(signature);

      const tx = new Transaction();
      tx.moveCall({
        target: `${sealConfig.packageId}::lottery_seal::seal_approve`,
        arguments: [tx.pure.vector('u8', Array.from(identityBytes)), tx.object(lottery.id)],
      });
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });
      const decoded = textDecoder.decode(decryptedBytes);
      setDecryptedInfos((prev) => ({ ...prev, [winnerIdx]: decoded }));
    } catch (error) {
      console.error('Failed to decrypt shipping info', error);
      setDecryptError(error instanceof Error ? error.message : 'Failed to decrypt shipping info.');
    } finally {
      setDecryptingIdx(null);
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-3xl bg-[#0c111c] p-8 text-left align-middle text-white shadow-xl transition-all border border-white/10">
                <Dialog.Title className="text-3xl font-bold">Lottery Details</Dialog.Title>

                <div className="mt-6 grid gap-4 md:grid-cols-2 text-sm text-gray-300">
                  <div>
                    <p className="uppercase tracking-widest text-[10px] text-gray-500 mb-1">Lottery ID</p>
                    <p className="font-mono text-base text-white break-all">{lottery.id}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-[10px] text-gray-500 mb-1">
                      Creator
                    </p>
                    <p className="font-mono text-base text-white break-all">
                      {lottery.creator ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-[10px] text-gray-500 mb-1">Deadline</p>
                    <p className="text-white text-base">
                      {lottery.deadline ? new Date(lottery.deadline).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-[10px] text-gray-500 mb-1">
                      Participants
                    </p>
                    <p className="text-white text-base">{lottery.participants}</p>
                  </div>
                </div>

                {decryptError && (
                  <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {decryptError}
                  </div>
                )}

                <div className="mt-6">
                  <p className="uppercase tracking-widest text-[10px] text-gray-500 mb-3">All prizes</p>
                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                    {lottery.names.map((name, idx) => {
                      const winnerEntries: { address: string; winnerIdx: number }[] = [];
                      if (winners.length && lottery.winnerPrizeIndices?.length) {
                        lottery.winnerPrizeIndices.forEach((prizeIndex, winnerIdx) => {
                          if (Number(prizeIndex) === idx) {
                            winnerEntries.push({ address: winners[winnerIdx], winnerIdx });
                          }
                        });
                      }
                      return (
                        <div key={idx} className="rounded-2xl border border-white/5 bg-white/5 px-3 py-2 bg-opacity-5">
                          <div className="flex justify-between text-sm text-white">
                            <span className="flex items-center gap-2">
                              {name}
                              <span className="text-xs text-gray-400">×{lottery.quantities[idx] ?? 0}</span>
                            </span>
                          </div>
                          <div className="mt-2 space-y-2 text-xs text-gray-300 text-left">
                            {winnerEntries.length === 0 && <p>No winner recorded yet</p>}
                            {winnerEntries.map(({ address, winnerIdx }) => {
                              const winnerClaimed = Boolean(claimed[winnerIdx]);
                              const decrypted = decryptedInfos[winnerIdx];
                              const encryptedHex = shippingEncryptedInfos[winnerIdx];
                              return (
                                <div key={`${address}-${winnerIdx}`} className="rounded-xl border border-white/10 p-3">
                                  <p className="text-[11px] uppercase text-gray-500 mb-1">Winner</p>
                                  <p className="font-mono text-sm text-white break-all">{address}</p>
                                  {!winnerClaimed && (
                                    <p className="text-yellow-400 text-xs font-semibold mt-2">Pending claim</p>
                                  )}
                                  {winnerClaimed && !decrypted && isCreator && (
                                    <div className="mt-2 space-y-2">
                                      {encryptedHex ? (
                                        <>
                                          <p className="text-[11px] text-gray-400">
                                            Claim received. Decrypt to view shipping info.
                                          </p>
                                          <div className="flex gap-2 flex-wrap">
                                            <button
                                              type="button"
                                              className="rounded-full bg-sui-green text-black px-4 py-1 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                              onClick={() => handleDecrypt(winnerIdx)}
                                              disabled={decryptingIdx === winnerIdx}
                                            >
                                              {decryptingIdx === winnerIdx ? 'Decrypting…' : 'Decrypt shipping info'}
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded-full border border-white/20 px-4 py-1 text-xs font-semibold hover:bg-white/10"
                                              onClick={() => navigator.clipboard.writeText(encryptedHex)}
                                            >
                                              Copy cipher
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <p className="text-xs text-gray-400">Claimed, awaiting payload upload.</p>
                                      )}
                                    </div>
                                  )}
                                  {winnerClaimed && decrypted && (
                                    <div className="mt-3 rounded-xl border border-sui-green/50 bg-sui-green/5 p-3 text-white text-sm whitespace-pre-wrap break-words">
                                      {decrypted}
                                    </div>
                                  )}
                                  {winnerClaimed && !isCreator && (
                                    <p className="text-green-400 text-xs font-semibold mt-2">Claimed</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
