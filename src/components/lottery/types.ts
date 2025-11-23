export type LotteryCard = {
  id: string;
  names: string[];
  quantities: number[];
  settled: boolean;
  deadline: number;
  participants: number;
  participantsAddresses?: string[];
  creator?: string;
  winners?: string[];
  claimed?: boolean[];
  winnerPrizeIndices?: number[];
  shippingEncryptedInfos?: string[];
  shippingSealIds?: string[];
};
