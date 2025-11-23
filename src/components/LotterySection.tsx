import React, { useState } from 'react';
import { CreateLotteryModal } from './lottery/CreateLotteryModal';
import { LotteryCard } from './lottery/LotteryCard';
import { useLotteries } from './lottery/hooks/useLotteries';
import { DEFAULT_PACKAGE_ID } from './lottery/hooks/useLotteries';
import { LotteryDetailsDialog } from './lottery/LotteryDetailsDialog';
import { ClaimPrizeModal } from './lottery/ClaimPrizeModal';
import type { LotteryCard as LotteryCardType } from './lottery/types';

type FilterType = 'active' | 'expired' | null;

const LotterySection: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<LotteryCardType | null>(null);
  const [claimTarget, setClaimTarget] = useState<LotteryCardType | null>(null);
  const [filter, setFilter] = useState<FilterType>(null);
  const {
    lotteries,
    error,
    setError,
    joiningId,
    claimingId,
    currentAddress,
    canJoin,
    handleLotteryCreated,
    joinLottery,
    claimLottery,
  } = useLotteries();
  const toggleFilter = (value: Exclude<FilterType, null>) => {
    setFilter((prev) => (prev === value ? null : value));
  };
  const now = Date.now();
  const filteredLotteries = lotteries.filter((lottery) => {
    const deadlineValue = lottery.deadline ? Number(lottery.deadline) : null;
    const isExpired = Boolean(deadlineValue && deadlineValue <= now);
    if (filter === 'active') return !isExpired;
    if (filter === 'expired') return isExpired;
    return true;
  });
  const activeSorted = filteredLotteries
    .filter((lottery) => {
      const deadlineValue = lottery.deadline ? Number(lottery.deadline) : null;
      return !(deadlineValue && deadlineValue <= now);
    })
    .sort((a, b) => Number(b.deadline ?? 0) - Number(a.deadline ?? 0));
  const expiredSorted = filteredLotteries
    .filter((lottery) => {
      const deadlineValue = lottery.deadline ? Number(lottery.deadline) : null;
      return Boolean(deadlineValue && deadlineValue <= now);
    })
    .sort((a, b) => Number(b.deadline ?? 0) - Number(a.deadline ?? 0));
  const sortedLotteries = [...activeSorted, ...expiredSorted];
  const hasLotteries = lotteries.length > 0;
  const hasFilteredLotteries = sortedLotteries.length > 0;

  return (
    <section id="lottery" className="py-24 bg-sui-black border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h2 className="text-5xl font-display font-bold text-white mb-4">Open Lotteries</h2>
            <p className="text-gray-400 max-w-2xl">
              Create verifiable lotteries on Sui. New drops will appear below as soon as the transaction settles on-chain.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  filter === 'active'
                    ? 'border-sui-green bg-sui-green/10 text-white'
                    : 'border-white/20 text-gray-300 hover:border-white/40'
                }`}
                onClick={() => toggleFilter('active')}
              >
                Active
              </button>
              <button
                type="button"
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  filter === 'expired'
                    ? 'border-red-500 bg-red-500/10 text-white'
                    : 'border-white/20 text-gray-300 hover:border-white/40'
                }`}
                onClick={() => toggleFilter('expired')}
              >
                Expired
              </button>
            </div>
          </div>
          <button
            type="button"
            className="bg-white text-black hover:bg-sui-green transition-colors px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowModal(true)}
            disabled={!canJoin}
          >
            Create Lottery
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <div className="flex justify-between items-center gap-4">
              <span>{error}</span>
              <button
                type="button"
                className="text-xs font-semibold text-white/70 underline"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!hasLotteries ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-10 text-center text-gray-400">
            <p>No on-chain lotteries have been created in this session.</p>
            <p className="text-sm mt-2">Use the Create Lottery button to deploy a new drop.</p>
          </div>
        ) : !hasFilteredLotteries ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-10 text-center text-gray-400">
            <p>No lotteries match this filter.</p>
            <p className="text-sm mt-2">Toggle filters above to see other lotteries.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedLotteries.map((lottery) => (
              <LotteryCard
                key={lottery.id}
                lottery={lottery}
                joiningId={joiningId}
                canJoin={canJoin}
                onJoin={joinLottery}
                currentAddress={currentAddress}
                claimingId={claimingId}
                onClaim={(target) => setClaimTarget(target)}
                onSelect={() => setSelected(lottery)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateLotteryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        clockObjectId="0x6"
        defaultPackageId={DEFAULT_PACKAGE_ID}
        onLotteryCreated={(id) => {
          setShowModal(false);
          handleLotteryCreated(id);
        }}
      />

      <LotteryDetailsDialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        lottery={selected}
        currentAddress={currentAddress}
      />

      <ClaimPrizeModal
        open={Boolean(claimTarget)}
        lottery={claimTarget}
        onClose={() => setClaimTarget(null)}
        currentAddress={currentAddress}
        submitting={Boolean(claimTarget && claimingId === claimTarget.id)}
        onSubmit={(lotteryId, sealBytes, encryptedInfo) => {
          claimLottery(lotteryId, sealBytes, encryptedInfo);
        }}
      />
    </section>
  );
};

export default LotterySection;
