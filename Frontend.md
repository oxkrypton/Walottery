# Walottery 合约调用说明（Frontend）

本文件汇总 `move/` 目录中各模块可供前端调用的入口，以及交互时需要的主要参数/注意事项。所有模块都属于 `0x6ffdbb10cf3cd3dc69e96d5461f01288d16c1bc10636cac5a09f47032d4b6c76` 命名空间（testnet 部署）。

## 模块概览

- `lottery_state`：定义 `Lottery` 共享对象及全部内部逻辑（前端一般不直接调）。
- `lottery_creation`：创建/开奖。
- `lottery_participation`：参与与中奖者上传收货信息。
- `lottery_seal`：解密前的权限校验。

> 前端需要持有 `Lottery` 对象 ID 并以 `shared object` 方式调用对应 entry 函数。

## `lottery_creation`

### `create_lottery`
```
public entry fun create_lottery(
    names: vector<String>,
    quantities: vector<u64>,
    deadline_ms: u64,
    clk: &sui::clock::Clock,
    ctx: &mut sui::tx_context::TxContext,
)
```

- `names/quantities`：奖品名称与份数，一一对应，每个 quantity > 0。
- `deadline_ms`：开奖时间（毫秒），必须大于当前链上时间。
- 该函数会创建并分享新的 `Lottery` 对象，返回值为空；需要从交易结果中读取出对象 ID。
- 调用时必须通过 `Clock` 共享对象（`0x6`）作为只读输入。

### `draw`
```
public entry fun draw(
    lottery: &mut Lottery,
    rand: &sui::random::Random,
    clk: &sui::clock::Clock,
    ctx: &mut sui::tx_context::TxContext,
)
```

- 要求当前时间 >= deadline，且尚未开奖。
- `rand` 为 Sui 随机数共享对象（`0x8`），由系统维护。
- 成功后会将 `lottery.winners` 填充并标记 `settled = true`。

## `lottery_participation`

### `join`
```
public entry fun join(
    lottery: &mut Lottery,
    clk: &sui::clock::Clock,
    ctx: &mut sui::tx_context::TxContext,
)
```

- 任意地址可调用，必须在截止时间前，且同一地址只能参加一次。
- 传入 Lottery 共享对象和 Clock。

### `claim`
```
public entry fun claim(
    lottery: &mut Lottery,
    seal_id: vector<u8>,
    encrypted_shipping_info: vector<u8>,
    ctx: &mut sui::tx_context::TxContext,
)
```

- 仅限中奖者，且开奖已经完成。
- `seal_id` 与 `encrypted_shipping_info` 来自前端对用户收货信息加密后的产物（Seal SDK）。
- 成功后会将 `claimed[idx]` 设为 `true` 并记录密文。

## `lottery_seal`

### `seal_approve`
```
entry fun seal_approve(
    _id: vector<u8>,
    lottery: &Lottery,
    ctx: &sui::tx_context::TxContext,
)
```

- 用于 Seal Key Server 在解密前执行 dry-run：只有创建者地址 (`lottery.creator`) 可以通过校验。
- `_id` 为 Seal identity（内部字段），无需合约处理。
- 调用者不是创建者则会以 `E_SEAL_NO_ACCESS` 中止。
- `seal_approve*` 函数在 Seal 评估期间通过 fullnode 的 `dry_run_transaction_block` 执行，必须无副作用且不要依赖快速变化的链上状态。

### Seal 前端集成

- 前端侧的 Seal SDK 负责生成 `(seal_id, encrypted_info)`：
  - 在 `.env` 中设置 `VITE_SEAL_KEY_SERVERS`（JSON 数组或逗号分隔）来指明 KeyServer 对象 ID 及权重，例如  
    `VITE_SEAL_KEY_SERVERS='[{"objectId":"0x...","weight":1}]'`。
  - 可选：`VITE_SEAL_RPC_URL`（默认使用 testnet fullnode）、`VITE_SEAL_THRESHOLD`、`VITE_SEAL_IDENTITY_PREFIX`、`VITE_SEAL_VERIFY_KEY_SERVERS`.
  - App 端通过 `SealClient.encrypt` 生成密文。identity 推荐拼接 `prefix:lottery_id:winner_address`，以便后续 `seal_approve` 匹配。
- Seal SDK 会在本地创建 `SealClient` 并访问配置好的 KeyServer。KeyServer 只需注册一次，保持固定列表可避免被假冒；如果允许用户自选 KeyServer，请启用 `verifyKeyServers`.
- 中奖人提交表单后会触发 Seal 加密，然后把 `(seal_id bytes, encrypted_shipping_info bytes)` 传给链上的 `lottery_participation::claim`。

## 常见错误码

| 代码 | 名称                 | 含义                                |
| ---- | -------------------- | ----------------------------------- |
| 1    | `E_INVALID_PARAM`    | 奖品参数不合法                     |
| 2    | `E_INVALID_DEADLINE` | 截止时间不在未来                   |
| 3    | `E_NO_PRIZE`         | 没有奖品                          |
| 4    | `E_ALREADY_SETTLED`  | 已开奖                            |
| 5    | `E_BEFORE_DEADLINE`  | 未到开奖时间                      |
| 6    | `E_NO_PARTICIPANTS`  | 没有参与者                        |
| 7    | `E_ALREADY_JOINED`   | 地址重复加入                      |
| 8    | `E_NOT_SETTLED`      | 还未开奖                          |
| 9    | `E_NOT_WINNER`       | 非中奖者尝试 claim                |
| 10   | `E_ALREADY_CLAIMED`  | 重复 claim                       |
| 11   | `E_SEAL_NO_ACCESS`   | 非创建者请求 seal_approve         |

## 前端调用提示

1. **共享对象**：所有 entry 函数都需要 Lottery 共享对象 ID。阅读对象状态可调用 `sui_client.getObject`.
2. **Clock & Random**：`create_lottery`/`join`/`draw` 等需要链上共享对象，前端必须在 PTB 中引入相应的共享引用。
3. **Package ID**：testnet package 为 `0xdd1734cf0a9cf98897e6a85c0b5355cb4471c63e42f4b8dbaf90d6d677573321`; 合约模块路径如 `0xdd17::lottery_creation::create_lottery`.
4. **Seal 流程**：前端需先用 Seal SDK 加密收货信息得到 `(seal_id, encrypted_info)`，再调用 `claim`；后台解密前调用 `seal_approve` 验证是否为创建者。
