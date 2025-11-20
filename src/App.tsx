import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import {
  Box,
  Container,
  Flex,
  Heading,
  Section,
  Text,
} from "@radix-ui/themes";

function App() {
  const currentAccount = useCurrentAccount();

  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>Walottery Dashboard</Heading>
          <Text size="2" color="gray">
            Frontend scaffold for interacting with the Move contracts in /move
          </Text>
        </Box>

        <Box>
          <ConnectButton />
        </Box>
      </Flex>

      <Container size="3" mt="5" px="4" pb="6">
        <Section size="2" mb="4" style={{ background: "var(--gray-a2)" }}>
          <Heading size="4">Connection Status</Heading>
          <Text size="2" color="gray">
            {currentAccount
              ? `Connected as ${currentAccount.address}`
              : "请先连接 Sui 钱包以加载 Walottery 数据。"}
          </Text>
        </Section>

        <Section
          size="2"
          mb="4"
          style={{ background: "var(--gray-a2)", minHeight: "140px" }}
        >
          <Heading size="4">Lottery Overview</Heading>
          <Text size="2" color="gray">
            在这里接入合约读取：奖池列表、开奖时间、中奖名单等等。此模板目前仅保留 UI
            框架和 WalletProvider，可按照业务需求填充组件。
          </Text>
        </Section>

        <Section size="2" style={{ background: "var(--gray-a2)" }}>
          <Heading size="4">Actions</Heading>
          <Text size="2" color="gray">
            未来可在此加入创建抽奖、参与、开奖、领取等交互按钮。随着 Move 合约更新，
            只需在 src 目录下添加对应的 hooks / 组件即可。
          </Text>
        </Section>
      </Container>
    </>
  );
}

export default App;
