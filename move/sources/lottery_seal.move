module walottery::lottery_seal {

    use walottery::lottery_state::{Self as state, Lottery};

    /// ============= Seal 访问控制（解密权限） =============
    entry fun seal_approve(
        _id: vector<u8>,
        lottery: &Lottery,
        ctx: &sui::tx_context::TxContext,
    ) {
        let caller = sui::tx_context::sender(ctx);
        assert!(caller == state::creator(lottery), state::err_seal_no_access());
    }
}
