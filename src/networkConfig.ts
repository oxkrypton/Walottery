import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    devnet: {
      url: getFullnodeUrl("devnet"),
      variables: {
        lotteryPackageId: "",
      },
    },
    testnet: {
      url: getFullnodeUrl("testnet"),
      variables: {
        lotteryPackageId:
          "0xdd1734cf0a9cf98897e6a85c0b5355cb4471c63e42f4b8dbaf90d6d677573321",
      },
    },
    mainnet: {
      url: getFullnodeUrl("mainnet"),
      variables: {
        lotteryPackageId: "",
      },
    },
  });

export { useNetworkVariable, useNetworkVariables, networkConfig };
