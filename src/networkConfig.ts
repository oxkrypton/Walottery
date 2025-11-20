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
        lotteryPackageId: "",
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
