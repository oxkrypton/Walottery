#[test_only]
module walottery::claim_tests;

use std::string;

use sui::clock;
use sui::random;
use sui::test_scenario::{Self as scenario, Scenario};

use walottery::lottery_creation;
use walottery::lottery_participation;
use walottery::lottery_state::{Self as state, Lottery};

const CLAIM_DEADLINE_OFFSET: u64 = 1_000;

#[test]
fun test_claim_success() {
    let creator = @0x99;
    let winner = @0x100;
    let loser = @0x101;

    let mut scn = scenario::begin(creator);
    scenario::create_system_objects(&mut scn);

    let deadline = initialize_lottery(&mut scn, winner, loser, 2);
    let winners = draw_after_deadline(&mut scn, creator, deadline);
    let actual_winner = *vector::borrow(&winners, 0);

    scenario::next_tx(&mut scn, actual_winner);
    {
        let mut lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_participation::claim(
            &mut lottery,
            vector[1, 2, 3],
            vector[4, 5, 6],
            ctx,
        );
        scenario::return_shared(lottery);
    };

    scenario::end(scn);
}

#[test, expected_failure(
    abort_code = walottery::lottery_state::E_NOT_WINNER,
    location = walottery::lottery_participation
)]
fun test_claim_non_winner_fails() {
    let creator = @0xA1;
    let winner = @0xB1;
    let loser = @0xC1;

    let mut scn = scenario::begin(creator);
    scenario::create_system_objects(&mut scn);

    let deadline = initialize_lottery(&mut scn, winner, loser, 1);
    let winners = draw_after_deadline(&mut scn, creator, deadline);
    let actual_winner = *vector::borrow(&winners, 0);
    let non_winner = if (actual_winner == winner) { loser } else { winner };

    scenario::next_tx(&mut scn, non_winner);
    {
        let mut lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_participation::claim(
            &mut lottery,
            vector[7, 7, 7],
            vector[8, 8, 8],
            ctx,
        );
        scenario::return_shared(lottery);
    };

    scenario::end(scn);
}

#[test, expected_failure(
    abort_code = walottery::lottery_state::E_ALREADY_CLAIMED,
    location = walottery::lottery_state
)]
fun test_claim_duplicate_fails() {
    let creator = @0xA2;
    let winner = @0xB2;
    let loser = @0xC2;

    let mut scn = scenario::begin(creator);
    scenario::create_system_objects(&mut scn);

    let deadline = initialize_lottery(&mut scn, winner, loser, 2);
    let winners = draw_after_deadline(&mut scn, creator, deadline);
    let actual_winner = *vector::borrow(&winners, 0);

    scenario::next_tx(&mut scn, actual_winner);
    {
        let mut lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_participation::claim(
            &mut lottery,
            vector[1, 1, 1],
            vector[2, 2, 2],
            ctx,
        );
        scenario::return_shared(lottery);
    };

    scenario::next_tx(&mut scn, actual_winner);
    {
        let mut lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_participation::claim(
            &mut lottery,
            vector[9, 9],
            vector[9, 9],
            ctx,
        );
        scenario::return_shared(lottery);
    };

    scenario::end(scn);
}

fun initialize_lottery(
    scn: &mut Scenario,
    winner: address,
    loser: address,
    prize_units: u64,
): u64 {
    let deadline = {
        let clock_obj = scenario::take_shared<clock::Clock>(scn);
        let now = clock::timestamp_ms(&clock_obj);
        let deadline = now + CLAIM_DEADLINE_OFFSET;
        let ctx = scenario::ctx(scn);
        let mut quantities = vector[];
        vector::push_back(&mut quantities, prize_units);
        lottery_creation::create_lottery(
            vector[string::utf8(b"Prize")],
            quantities,
            deadline,
            &clock_obj,
            ctx,
        );
        scenario::return_shared(clock_obj);
        deadline
    };

    join_player(scn, winner);
    join_player(scn, loser);
    deadline
}

fun join_player(scn: &mut Scenario, player: address) {
    scenario::next_tx(scn, player);
    {
        let mut lottery = scenario::take_shared<Lottery>(scn);
        let clock_obj = scenario::take_shared<clock::Clock>(scn);
        let ctx = scenario::ctx(scn);
        lottery_participation::join(&mut lottery, &clock_obj, ctx);
        scenario::return_shared(clock_obj);
        scenario::return_shared(lottery);
    };
}

fun draw_after_deadline(
    scn: &mut Scenario,
    creator: address,
    deadline: u64,
): vector<address> {
    scenario::next_tx(scn, creator);
    let winners_vec = {
        let mut lottery = scenario::take_shared<Lottery>(scn);
        let mut clock_obj = scenario::take_shared<clock::Clock>(scn);
        clock::set_for_testing(&mut clock_obj, deadline + 1);
        let random_obj = scenario::take_shared<random::Random>(scn);
        let ctx = scenario::ctx(scn);
        lottery_creation::draw(&mut lottery, &random_obj, &clock_obj, ctx);
        let winners = copy_winners(&lottery);
        scenario::return_shared(random_obj);
        scenario::return_shared(clock_obj);
        scenario::return_shared(lottery);
        winners
    };
    winners_vec
}

fun copy_winners(lottery: &Lottery): vector<address> {
    let winners = state::winners_ref(lottery);
    let mut out = vector[];
    let len = vector::length(winners);
    let mut i = 0;
    while (i < len) {
        vector::push_back(&mut out, *vector::borrow(winners, i));
        i = i + 1;
    };
    out
}
