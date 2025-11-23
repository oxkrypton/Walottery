module walottery::lottery_state {

    use std::string::String;

    /// ===== 错误码 =====
    const E_INVALID_PARAM: u64 = 1;
    const E_INVALID_DEADLINE: u64 = 2;
    const E_NO_PRIZE: u64 = 3;
    const E_ALREADY_SETTLED: u64 = 4;
    const E_BEFORE_DEADLINE: u64 = 5;
    const E_NO_PARTICIPANTS: u64 = 6;
    const E_ALREADY_JOINED: u64 = 7;
    const E_NOT_SETTLED: u64 = 8;
    const E_NOT_WINNER: u64 = 9;
    const E_ALREADY_CLAIMED: u64 = 10;
    const E_SEAL_NO_ACCESS: u64 = 11;

    public fun err_invalid_param(): u64 {
        E_INVALID_PARAM
    }

    public fun err_invalid_deadline(): u64 {
        E_INVALID_DEADLINE
    }

    public fun err_no_prize(): u64 {
        E_NO_PRIZE
    }

    public fun err_not_winner(): u64 {
        E_NOT_WINNER
    }

    public fun err_seal_no_access(): u64 {
        E_SEAL_NO_ACCESS
    }

    /// 单种奖品模板，比如 “MacBook Pro 1 台”“iPhone 3 台”
    public struct PrizeTemplate has store {
        name: String,
        quantity: u64,
    }

    /// 抽奖主对象（共享对象）
    public struct Lottery has key, store {
        id: sui::object::UID,
        creator: address,
        deadline_ms: u64,
        total_prize_units: u64,
        prize_templates: vector<PrizeTemplate>,
        settled: bool,
        participants: vector<address>,
        winners: vector<address>,
        winner_prize_template_index: vector<u64>,
        claimed: vector<bool>,
        shipping_seal_ids: vector<vector<u8>>,
        shipping_encrypted_infos: vector<vector<u8>>,
    }

    /// 构建奖品模板列表及总份数
    public(package) fun build_prize_templates(
        names: vector<String>,
        quantities: vector<u64>,
    ): (vector<PrizeTemplate>, u64) {
        let len = vector::length(&names);
        assert!(len > 0, E_NO_PRIZE);
        let mut names = names;
        let mut quantities = quantities;

        let mut prize_templates = vector::empty<PrizeTemplate>();
        let mut total_units = 0u64;
        let mut i = 0u64;
        while (i < len) {
            let q = vector::pop_back(&mut quantities);
            assert!(q > 0, E_INVALID_PARAM);

            let name = vector::pop_back(&mut names);

            total_units = total_units + q;

            vector::push_back(
                &mut prize_templates,
                PrizeTemplate { name, quantity: q },
            );

            i = i + 1;
        };
        assert!(total_units > 0, E_NO_PRIZE);
        (prize_templates, total_units)
    }

    /// 创建 Lottery 对象
    public(package) fun new_lottery(
        creator: address,
        deadline_ms: u64,
        total_units: u64,
        prize_templates: vector<PrizeTemplate>,
        ctx: &mut sui::tx_context::TxContext,
    ): Lottery {
        Lottery {
            id: sui::object::new(ctx),
            creator,
            deadline_ms,
            total_prize_units: total_units,
            prize_templates,
            settled: false,
            participants: vector::empty<address>(),
            winners: vector::empty<address>(),
            winner_prize_template_index: vector::empty<u64>(),
            claimed: vector::empty<bool>(),
            shipping_seal_ids: vector::empty<vector<u8>>(),
            shipping_encrypted_infos: vector::empty<vector<u8>>(),
        }
    }

    public(package) fun share_lottery(lottery: Lottery) {
        sui::transfer::share_object(lottery);
    }

    public(package) fun ensure_join_window(lottery: &Lottery, now: u64) {
        assert!(!lottery.settled, E_ALREADY_SETTLED);
        assert!(now < lottery.deadline_ms, E_BEFORE_DEADLINE);
    }

    public(package) fun ensure_draw_window(lottery: &Lottery, now: u64) {
        assert!(!lottery.settled, E_ALREADY_SETTLED);
        assert!(now >= lottery.deadline_ms, E_BEFORE_DEADLINE);
    }

    public(package) fun ensure_settled(lottery: &Lottery) {
        assert!(lottery.settled, E_NOT_SETTLED);
    }

    public(package) fun ensure_has_participants(lottery: &Lottery) {
        assert!(vector::length(&lottery.participants) > 0, E_NO_PARTICIPANTS);
    }

    public(package) fun ensure_has_prizes(lottery: &Lottery) {
        assert!(lottery.total_prize_units > 0, E_NO_PRIZE);
    }

    public(package) fun register_participant(lottery: &mut Lottery, participant: address) {
        assert!(!contains_address(&lottery.participants, participant), E_ALREADY_JOINED);
        vector::push_back(&mut lottery.participants, participant);
    }

    public(package) fun participants_len(lottery: &Lottery): u64 {
        vector::length(&lottery.participants)
    }

    public(package) fun participants_mut(lottery: &mut Lottery): &mut vector<address> {
        &mut lottery.participants
    }

    public(package) fun participant_at(lottery: &Lottery, idx: u64): address {
        *vector::borrow(&lottery.participants, idx)
    }

    public(package) fun prize_templates_ref(lottery: &Lottery): &vector<PrizeTemplate> {
        &lottery.prize_templates
    }

    public(package) fun expand_prize_units(templates: &vector<PrizeTemplate>): vector<u64> {
        build_prize_indices(templates)
    }

    public(package) fun record_winner(lottery: &mut Lottery, winner: address, prize_index: u64) {
        vector::push_back(&mut lottery.winners, winner);
        vector::push_back(&mut lottery.winner_prize_template_index, prize_index);
        vector::push_back(&mut lottery.claimed, false);
        vector::push_back(&mut lottery.shipping_seal_ids, vector::empty<u8>());
        vector::push_back(&mut lottery.shipping_encrypted_infos, vector::empty<u8>());
    }

    public(package) fun lottery_id(lottery: &Lottery): sui::object::ID {
        sui::object::id(lottery)
    }

    public(package) fun mark_settled(lottery: &mut Lottery) {
        lottery.settled = true;
    }

    public(package) fun winner_index(lottery: &Lottery, addr: address): (bool, u64) {
        find_winner_index(&lottery.winners, addr)
    }

    public(package) fun shipping_seal_id_ref(
        lottery: &Lottery,
        idx: u64,
    ): &vector<u8> {
        vector::borrow(&lottery.shipping_seal_ids, idx)
    }

    public(package) fun shipping_info_ref(
        lottery: &Lottery,
        idx: u64,
    ): &vector<u8> {
        vector::borrow(&lottery.shipping_encrypted_infos, idx)
    }

    public(package) fun winners_ref(lottery: &Lottery): &vector<address> {
        &lottery.winners
    }

    public(package) fun is_claimed(lottery: &Lottery, idx: u64): bool {
        *vector::borrow(&lottery.claimed, idx)
    }

    public(package) fun write_claim(
        lottery: &mut Lottery,
        idx: u64,
        seal_id: vector<u8>,
        encrypted_shipping_info: vector<u8>,
    ) {
        let claimed_ref = vector::borrow_mut(&mut lottery.claimed, idx);
        assert!(!*claimed_ref, E_ALREADY_CLAIMED);
        *claimed_ref = true;

        let seal_slot = vector::borrow_mut(&mut lottery.shipping_seal_ids, idx);
        *seal_slot = seal_id;

        let info_slot = vector::borrow_mut(&mut lottery.shipping_encrypted_infos, idx);
        *info_slot = encrypted_shipping_info;
    }

    public(package) fun creator(lottery: &Lottery): address {
        lottery.creator
    }

    /// ======== 辅助函数：展开所有奖品份数 ========
    fun build_prize_indices(templates: &vector<PrizeTemplate>): vector<u64> {
        let mut indices = vector::empty<u64>();
        let len = vector::length(templates);
        let mut i = 0u64;
        while (i < len) {
            let t_ref = vector::borrow(templates, i);
            let mut j = 0u64;
            while (j < t_ref.quantity) {
                vector::push_back(&mut indices, i);
                j = j + 1;
            };
            i = i + 1;
        };
        indices
    }

    /// ======== 辅助函数：检查地址是否在 vector 中 ========
    fun contains_address(addrs: &vector<address>, addr: address): bool {
        let len = vector::length(addrs);
        let mut i = 0u64;
        while (i < len) {
            if (*vector::borrow(addrs, i) == addr) {
                return true;
            };
            i = i + 1;
        };
        false
    }

    /// ======== 辅助函数：查找中奖者索引 ========
    fun find_winner_index(
        winners: &vector<address>,
        addr: address,
    ): (bool, u64) {
        let len = vector::length(winners);
        let mut i = 0u64;
        while (i < len) {
            if (*vector::borrow(winners, i) == addr) {
                return (true, i);
            };
            i = i + 1;
        };
        (false, 0)
    }
}
