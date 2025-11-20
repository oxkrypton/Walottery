#[test_only]
module walottery::creation_tests;

use std::string;
use std::unit_test;

use sui::clock;
use sui::test_scenario;

use walottery::lottery_creation;
use walottery::lottery_state::{Self as state, Lottery};

#[test]
fun test_create_lottery_single_prize() {
    let creator = @0xA;
    let mut scenario = test_scenario::begin(creator);
    test_scenario::create_system_objects(&mut scenario);

    let clock_obj = test_scenario::take_shared<clock::Clock>(&scenario);
    let now = clock::timestamp_ms(&clock_obj);
    let deadline = now + 10_000;

    {
        let ctx = test_scenario::ctx(&mut scenario);
        lottery_creation::create_lottery(
            vector[
                string::utf8(b"Prize A"),
                string::utf8(b"Prize B"),
                string::utf8(b"Prize C"),
            ],
            vector[1, 2, 3],
            deadline,
            &clock_obj,
            ctx,
        );
    };
    test_scenario::return_shared(clock_obj);

    test_scenario::next_tx(&mut scenario, creator);

    // build_prize_templates consumes vectors via pop_back, so the stored order is reversed
    let expected_quantities = vector[3, 2, 1];
    let lottery = test_scenario::take_shared<Lottery>(&scenario);
    let templates = state::prize_templates_ref(&lottery);
    unit_test::assert_eq!(vector::length(templates), vector::length(&expected_quantities));
    unit_test::assert_eq!(state::participants_len(&lottery), 0);
    unit_test::assert_eq!(state::creator(&lottery), creator);

    let expanded = state::expand_prize_units(templates);
    unit_test::assert_eq!(vector::length(&expanded), 6);

    let mut counts = vector[];
    let template_len = vector::length(templates);
    let mut i = 0;
    while (i < template_len) {
        vector::push_back(&mut counts, 0);
        i = i + 1;
    };

    let total_units = vector::length(&expanded);
    let mut j = 0;
    while (j < total_units) {
        let idx = *vector::borrow(&expanded, j);
        let qty_ref = vector::borrow_mut(&mut counts, idx);
        *qty_ref = *qty_ref + 1;
        j = j + 1;
    };

    let mut k = 0;
    while (k < template_len) {
        unit_test::assert_eq!(
            *vector::borrow(&counts, k),
            *vector::borrow(&expected_quantities, k)
        );
        k = k + 1;
    };

    test_scenario::return_shared(lottery);

    test_scenario::end(scenario);
}
