module walottery::lottery_participation {

    use walottery::lottery_state::{Self as state, Lottery};

    /// ============= 参与抽奖 =============
    #[allow(lint(public_entry))]
    public entry fun join(
        lottery: &mut Lottery,
        clk: &sui::clock::Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let now = sui::clock::timestamp_ms(clk);
        state::ensure_join_window(lottery, now);

        let sender = sui::tx_context::sender(ctx);
        state::register_participant(lottery, sender);
    }

    /// ============= 中奖用户 claim & 上传 Seal 加密收货信息 =============
    #[allow(lint(public_entry))]
    public entry fun claim(
        lottery: &mut Lottery,
        seal_id: vector<u8>,
        encrypted_shipping_info: vector<u8>,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        state::ensure_settled(lottery);

        let sender = sui::tx_context::sender(ctx);
        let (found, idx) = state::winner_index(lottery, sender);
        assert!(found, state::err_not_winner());

        state::write_claim(lottery, idx, seal_id, encrypted_shipping_info);
    }
}
