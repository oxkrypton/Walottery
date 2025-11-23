import type { LotteryCard as LotteryCardType } from './types';

const formatParticipants = (participants: number) => `${participants} entrant${participants === 1 ? '' : 's'}`;

type Props = {
  lottery: LotteryCardType;
  joiningId: string | null;
  claimingId: string | null;
  currentAddress: string | null;
  canJoin: boolean;
  onJoin: (lotteryId: string) => void;
  onClaim: (lottery: LotteryCardType) => void;
  onSelect: (lottery: LotteryCardType) => void;
};

export function LotteryCard({
  lottery,
  joiningId,
  claimingId,
  currentAddress,
  canJoin,
  onJoin,
  onClaim,
  onSelect,
}: Props) {
  const deadlineValue = lottery.deadline ? Number(lottery.deadline) : null;
  const deadlineLabel = deadlineValue ? new Date(deadlineValue).toLocaleString() : '—';
  const isExpired = Boolean(deadlineValue && deadlineValue <= Date.now());
  const isJoining = joiningId === lottery.id;
  const additionalPrizes = lottery.names.length > 1 ? `+${lottery.names.length - 1} more` : '';
  const primaryPrize = lottery.names[0] || 'Mystery Prize';
  const primaryQuantity = lottery.quantities[0];
  const hasMorePrizes = lottery.names.length > 1;
  const handleSelect = () => onSelect(lottery);
  const winners = lottery.winners ?? [];
  const claimed = lottery.claimed ?? [];
  const winnerIndex =
    currentAddress && winners.length ? winners.findIndex((addr) => addr.toLowerCase() === currentAddress.toLowerCase()) : -1;
  const isWinner = winnerIndex >= 0;
  const hasClaimed = isWinner && claimed.length > winnerIndex ? Boolean(claimed[winnerIndex]) : false;
  const canClaimPrize = lottery.settled && isWinner && !hasClaimed;
  const isClaiming = claimingId === lottery.id;
  const creatorAddress = lottery.creator?.toLowerCase();
  const accountAddress = currentAddress?.toLowerCase();
  const isCreator = Boolean(creatorAddress && accountAddress && creatorAddress === accountAddress);
  const highlightCreator = lottery.settled && isCreator;

  const joinDisabled = !canJoin || lottery.settled || isJoining || isExpired;
  const joinButtonClasses = [
    'w-full rounded-full transition-colors px-6 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
    isExpired ? 'bg-gray-600 text-gray-300 hover:bg-gray-600 cursor-not-allowed' : 'bg-white text-black hover:bg-sui-green',
  ].join(' ');
  const claimButtonClasses = [
    'w-full rounded-full transition-colors px-6 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
    canClaimPrize ? 'bg-sui-blue text-white hover:bg-sui-blue/90' : 'bg-gray-700 text-gray-300 cursor-not-allowed',
  ].join(' ');
  const joinButtonLabel = isJoining ? 'Joining…' : isExpired ? 'Expired' : 'Join';
  const claimButtonLabel = isClaiming
    ? 'Claiming…'
    : canClaimPrize
      ? 'Claim'
      : isWinner
        ? 'Claimed'
        : 'Expired';

  return (
    <div
      className={[
        'group relative flex flex-col overflow-hidden rounded-[32px] bg-[#111] text-white transition-all max-w-[360px] mx-auto w-full',
        highlightCreator
          ? 'border border-sui-green shadow-sui-green/30 animate-pulse'
          : 'border border-transparent hover:border-sui-blue hover:shadow-2xl hover:shadow-sui-blue/20',
      ].join(' ')}
    >
      <div
        className="relative h-64 w-full overflow-hidden bg-gradient-to-br from-[#0d1f33] via-[#123146] to-[#1c5b5c] cursor-pointer"
        onClick={handleSelect}
        role="button"
        tabIndex={0}
      >
        {highlightCreator && (
          <div className="absolute top-4 left-4 z-10 rounded-full bg-sui-green/90 text-black text-xs font-semibold px-3 py-1 shadow-lg">
            Drawn
          </div>
        )}
        <img
          src="/img/walrus1.jpg"
          alt="Lottery Prize"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111]" />
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-2 cursor-pointer" onClick={handleSelect} role="button" tabIndex={0}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-bold leading-tight text-white">
            {lottery.names[0] || 'Mystery Prize'}
            {additionalPrizes && (
              <span className="text-sm font-normal text-gray-400 ml-2">{additionalPrizes}</span>
            )}
          </h3>
          {isExpired && (
            <span className="inline-flex items-center rounded-full border border-red-500 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-300">
              Expired
            </span>
          )}
        </div>

        <div className="mb-6 grid gap-y-3 text-sm text-gray-400">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="uppercase tracking-wider text-[10px]">Lottery ID</span>
            <span className="font-mono text-white">
              {lottery.id.slice(0, 6)}...{lottery.id.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="uppercase tracking-wider text-[10px]">Deadline</span>
            <span className="text-white">{deadlineLabel}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="uppercase tracking-wider text-[10px]">Participants</span>
            <span className="text-white">{formatParticipants(lottery.participants)}</span>
          </div>

          <div className="pt-1">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span>Prize</span>
                {hasMorePrizes && (
                  <span className="text-[9px] font-semibold text-gray-400 tracking-widest">+more</span>
                )}
              </div>
              <span>Qty</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white truncate max-w-[180px]">{primaryPrize}</span>
                {primaryQuantity !== undefined && (
                  <span className="font-mono text-sui-blue">{primaryQuantity}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          {lottery.settled ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (canClaimPrize && !isClaiming) {
                  onClaim(lottery);
                }
              }}
              disabled={!canClaimPrize || isClaiming}
              className={claimButtonClasses}
            >
              {claimButtonLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (!joinDisabled) {
                  onJoin(lottery.id);
                }
              }}
              disabled={joinDisabled}
              className={joinButtonClasses}
            >
              {joinButtonLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
