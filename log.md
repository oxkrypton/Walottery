# Walottery

已部署/计划使用地址：
- 0x771f3ceafbbb0b3482e335c151e4a20092b78083bbc74ecae19233f7162965f0
- 0xddfa241c39ba6085ae6e1d179dce779d88779165d43d1d14a876297bd9eda6a8

## 合约概要
`walottery::physical_lottery` 提供实物抽奖流程，核心共享对象 `Lottery` 持有奖品模板、截止时间、参与者、中奖者及其收货加密信息。使用 `sui::random` 打乱参与者与奖品顺序，确保每个地址最多中奖一次。

## 基本流程
1. `create_lottery`：创建人提交奖品名称/份数与未来截止时间，生成共享对象。
2. `join`：任何地址在截止前参与，重复地址会被拒绝。
3. `draw`：截止后开奖，随机打乱参与者与展开的奖品份数，中奖人数为参与者和奖品总份数的较小值。
4. `claim`：中奖者上传 `seal_id` 与加密后的收货信息，仅能领取一次。
5. `seal_approve`：Seal 解密前的访问控制；仅抽奖创建者可解密任意中奖者的收货信息。

## 模块拆分（便于测试）
- `lottery_state`：定义 `PrizeTemplate`/`Lottery` 以及所有内部校验、状态写入、错误码函数。
- `lottery_creation`：封装创建/开奖入口，聚焦外部输入校验与随机流程，其他逻辑委托给 `lottery_state`。
- `lottery_participation`：对参赛与领奖流程提供入口函数，直接调用 `lottery_state` 的判定方法。
- `lottery_seal`：最小化的 Seal 访问控制模块，只检查调用者是否为创建者。

这种拆分让各模块的辅助函数可以被 `#[test_only]` 测试直接复用，同时也限制了共享对象操作必须通过 `lottery_state` 统一入口。

## 常见错误码
- 1 `E_INVALID_PARAM`：参数长度或份数非法
- 2 `E_INVALID_DEADLINE`：截止时间不在未来
- 4 `E_ALREADY_SETTLED` / 8 `E_NOT_SETTLED`：开奖状态异常
- 5 `E_BEFORE_DEADLINE`：未到开奖时间
- 6 `E_NO_PARTICIPANTS` / 3 `E_NO_PRIZE`：缺少参与者或奖品
- 7 `E_ALREADY_JOINED`：地址重复参与
- 9 `E_NOT_WINNER` / 10 `E_ALREADY_CLAIMED`：领奖资格或状态不符
