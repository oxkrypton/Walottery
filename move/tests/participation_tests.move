#[test_only]
module walottery::participation_tests;

use std::string;
use sui::clock;
use sui::random;
use sui::test_scenario;

use walottery::lottery_creation;
use walottery::lottery_participation;
use walottery::lottery_state::{Self as state, Lottery};

const E_ALREADY_JOINED: u64 = 7;
const E_BEFORE_DEADLINE: u64 = 5;

#[test]
fun test_join_and_claim_flow() {
    let creator = @0xAA;
    let user1 = @0xBB;
    let user2 = @0xCC;

    let mut scenario = test_scenario::begin(creator);
    test_scenario::create_system_objects(&mut scenario);

    let deadline_ms = {
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let now = clock::timestamp_ms(&clock_obj);
        let deadline = now + 5_000;
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_creation::create_lottery(
            vector[string::utf8(b"Prize A"), string::utf8(b"Prize B")],
            vector[1, 1],
            deadline,
            &clock_obj,
            ctx,
        );
        test_scenario::return_shared(clock_obj);
        deadline
    };

    test_scenario::next_tx(&mut scenario, user1);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_participation::join(&mut lottery, &clock_obj, ctx);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    test_scenario::next_tx(&mut scenario, user2);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_participation::join(&mut lottery, &clock_obj, ctx);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    let winner_addr: address;
    test_scenario::next_tx(&mut scenario, creator);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let mut clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        clock::set_for_testing(&mut clock_obj, deadline_ms + 1);
        let random_obj = test_scenario::take_shared<random::Random>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_creation::draw(&mut lottery, &random_obj, &clock_obj, ctx);
        let winners = state::winners_ref(&lottery);
        winner_addr = *vector::borrow(winners, 0);
        test_scenario::return_shared(random_obj);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    test_scenario::next_tx(&mut scenario, winner_addr);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_participation::claim(
            &mut lottery,
            vector[1, 2, 3],
            vector[4, 5, 6],
            ctx,
        );
        test_scenario::return_shared(lottery);
    };

    test_scenario::next_tx(&mut scenario, creator);
    {
        let lottery = test_scenario::take_shared<Lottery>(&scenario);
        let (found, idx) = state::winner_index(&lottery, winner_addr);
        assert!(found);
        assert!(state::is_claimed(&lottery, idx));
        test_scenario::return_shared(lottery);
    };

    test_scenario::end(scenario);
}

#[test, expected_failure(abort_code = Self::E_ALREADY_JOINED, location = walottery::lottery_state)]
fun test_join_rejects_duplicates() {
    let creator = @0x11;
    let user = @0x22;

    let mut scenario = test_scenario::begin(creator);
    test_scenario::create_system_objects(&mut scenario);

    let _deadline_ms = {
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let now = clock::timestamp_ms(&clock_obj);
        let deadline = now + 5_000;
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_creation::create_lottery(
            vector[string::utf8(b"Prize A")],
            vector[1],
            deadline,
            &clock_obj,
            ctx,
        );
        test_scenario::return_shared(clock_obj);
        deadline
    };

    test_scenario::next_tx(&mut scenario, user);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_participation::join(&mut lottery, &clock_obj, ctx);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    test_scenario::next_tx(&mut scenario, user);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        // This second join should abort with E_ALREADY_JOINED (7)
        lottery_participation::join(&mut lottery, &clock_obj, ctx);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    test_scenario::end(scenario);
}

#[test, expected_failure(abort_code = Self::E_BEFORE_DEADLINE, location = walottery::lottery_state)]
fun test_draw_before_deadline_fails() {
    let creator = @0x77;
    let user = @0x88;

    let mut scenario = test_scenario::begin(creator);
    test_scenario::create_system_objects(&mut scenario);

    let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
    let now = clock::timestamp_ms(&clock_obj);
    let deadline = now + 10_000;
    let ctx = test_scenario::ctx(&mut scenario);
    lottery_creation::create_lottery(
        vector[string::utf8(b"Prize X")],
        vector[1],
        deadline,
        &clock_obj,
        ctx,
    );
    test_scenario::return_shared(clock_obj);

    test_scenario::next_tx(&mut scenario, user);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_participation::join(&mut lottery, &clock_obj, ctx);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    test_scenario::next_tx(&mut scenario, creator);
    {
        let mut lottery = test_scenario::take_shared<Lottery>(&scenario);
        let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
        let random_obj = test_scenario::take_shared<random::Random>(&scenario);
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_creation::draw(&mut lottery, &random_obj, &clock_obj, ctx);
        test_scenario::return_shared(random_obj);
        test_scenario::return_shared(clock_obj);
        test_scenario::return_shared(lottery);
    };

    test_scenario::end(scenario);
}
