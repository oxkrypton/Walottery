module walottery::lottery_creation {

    use std::string::String;
    use sui::event;

    use walottery::lottery_state::{Self as state, Lottery};

    public struct LotteryCreated has copy, drop, store {
        lottery_id: sui::object::ID,
        creator: address,
        deadline_ms: u64,
        total_prize_units: u64,
    }

    /// ============= 创建实物抽奖 =============
    #[allow(lint(public_entry))]
    public entry fun create_lottery(
        names: vector<String>,
        quantities: vector<u64>,
        deadline_ms: u64,
        clk: &sui::clock::Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let len = vector::length(&names);
        assert!(len > 0, state::err_no_prize());
        assert!(len == vector::length(&quantities), state::err_invalid_param());

        let now = sui::clock::timestamp_ms(clk);
        assert!(deadline_ms > now, state::err_invalid_deadline());

        let (prize_templates, total_units) = state::build_prize_templates(names, quantities);

        let creator = sui::tx_context::sender(ctx);
        let lottery = state::new_lottery(
            creator,
            deadline_ms,
            total_units,
            prize_templates,
            ctx,
        );

        let lottery_id = state::lottery_id(&lottery);
        event::emit(LotteryCreated {
            lottery_id,
            creator,
            deadline_ms,
            total_prize_units: total_units,
        });

        state::share_lottery(lottery);
    }

    /// ============= 开奖 =============
    #[allow(lint(public_entry), lint(public_random))]
    public entry fun draw(
        lottery: &mut Lottery,
        rand: &sui::random::Random,
        clk: &sui::clock::Clock,
        ctx: &mut sui::tx_context::TxContext,
    ) {
        let now = sui::clock::timestamp_ms(clk);
        state::ensure_draw_window(lottery, now);
        state::ensure_has_participants(lottery);
        state::ensure_has_prizes(lottery);

        let participant_count = state::participants_len(lottery);

        let templates = state::prize_templates_ref(lottery);
        let mut prize_indices = state::expand_prize_units(templates);
        let total_prize_units = vector::length(&prize_indices);

        let winner_count = if (participant_count < total_prize_units) {
            participant_count
        } else {
            total_prize_units
        };

        let mut g: sui::random::RandomGenerator = sui::random::new_generator(rand, ctx);

        {
            let participants = state::participants_mut(lottery);
            sui::random::shuffle(&mut g, participants);
        };
        sui::random::shuffle(&mut g, &mut prize_indices);

        let mut i = 0u64;
        while (i < winner_count) {
            let winner = state::participant_at(lottery, i);
            let prize_index = *vector::borrow(&prize_indices, i);

            state::record_winner(lottery, winner, prize_index);
            i = i + 1;
        };

        state::mark_settled(lottery);
    }
}
