#[test_only]
module walottery::seal_tests;

use std::string;

use sui::clock;
use sui::random;
use sui::test_scenario::{Self as scenario, Scenario};

use walottery::lottery_creation;
use walottery::lottery_participation;
use walottery::lottery_seal;
use walottery::lottery_state::{Self as state, Lottery};

const SEAL_DEADLINE_OFFSET: u64 = 1_000;

#[test]
fun test_winner_claims_and_creator_can_decrypt() {
    let creator = @0x501;
    let winner = @0x502;

    let mut scn = scenario::begin(creator);
    scenario::create_system_objects(&mut scn);

    let deadline = initialize_lottery(&mut scn, vector[winner], 1);
    let winners = draw_after_deadline(&mut scn, creator, deadline);
    let actual_winner = *vector::borrow(&winners, 0);

    scenario::next_tx(&mut scn, actual_winner);
    {
        let mut lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_participation::claim(
            &mut lottery,
            vector[0xAA, 0xBB, 0xCC],
            vector[0x11, 0x22, 0x33],
            ctx,
        );
        let (found, idx) = state::winner_index(&lottery, actual_winner);
        assert!(found);
        let seal_ref = state::shipping_seal_id_ref(&lottery, idx);
        assert!(vector::length(seal_ref) == 3);
        assert!(*vector::borrow(seal_ref, 0) == 0xAA);
        let info_ref = state::shipping_info_ref(&lottery, idx);
        assert!(vector::length(info_ref) == 3);
        assert!(*vector::borrow(info_ref, 2) == 0x33);
        scenario::return_shared(lottery);
    };

    scenario::next_tx(&mut scn, creator);
    {
        let lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_seal::seal_approve(vector[0xFF], &lottery, ctx);
        scenario::return_shared(lottery);
    };

    scenario::end(scn);
}

#[test, expected_failure(
    abort_code = walottery::lottery_state::E_SEAL_NO_ACCESS,
    location = walottery::lottery_seal
)]
fun test_non_creator_cannot_decrypt() {
    let creator = @0x601;
    let winner = @0x602;

    let mut scn = scenario::begin(creator);
    scenario::create_system_objects(&mut scn);

    let deadline = initialize_lottery(&mut scn, vector[winner], 1);
    let winners = draw_after_deadline(&mut scn, creator, deadline);
    let actual_winner = *vector::borrow(&winners, 0);

    scenario::next_tx(&mut scn, actual_winner);
    {
        let mut lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_participation::claim(
            &mut lottery,
            vector[0x01],
            vector[0x02],
            ctx,
        );
        scenario::return_shared(lottery);
    };

    scenario::next_tx(&mut scn, actual_winner);
    {
        let lottery = scenario::take_shared<Lottery>(&scn);
        let ctx = scenario::ctx(&mut scn);
        lottery_seal::seal_approve(vector[0xEE], &lottery, ctx);
        scenario::return_shared(lottery);
    };

    scenario::end(scn);
}

fun initialize_lottery(
    scn: &mut Scenario,
    participants: vector<address>,
    prize_units: u64,
): u64 {
    let deadline = {
        let clock_obj = scenario::take_shared<clock::Clock>(scn);
        let now = clock::timestamp_ms(&clock_obj);
        let deadline = now + SEAL_DEADLINE_OFFSET;
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

    let len = vector::length(&participants);
    let mut i = 0;
    while (i < len) {
        join_player(scn, *vector::borrow(&participants, i));
        i = i + 1;
    };
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
