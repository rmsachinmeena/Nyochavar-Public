/**
 * Comprehensive Concurrency & Atomic Test Suite for Coupon Atomic Usage Count (Issue M3)
 * Tests race conditions, CAS updates, mutex serialization, and per-user limits.
 */
import { couponModel } from '../models/couponModel.js';
import { supabase } from '../config/supabase.js';

const TEST_COUPON_CODE = `TEST_ATOMIC_${Date.now()}`;
const TEST_USER_A = 'a0000000-0000-0000-0000-000000000001';
const TEST_USER_B = 'b0000000-0000-0000-0000-000000000002';

const results = [];

const logTest = (name, passed, details) => {
  results.push({ name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon}: ${name}`);
  if (details) console.log(`   Details: ${details}`);
};

async function runTests() {
  console.log('\n======== =============== ============== =================');
  console.log('🧪 RUNNING COUPON ATOMIC CONCURRENCY TEST SUITE');
  console.log('========== =============== ============== ===============\n');

  try {
    // -------------------------------------------------------------
    // SETUP: Create a test coupon with usage_limit = 2
    // -------------------------------------------------------------
    console.log(`Setting up test coupon: ${TEST_COUPON_CODE} with usage_limit = 2...`);
    const { data: createdCoupon, error: setupErr } = await supabase
      .from('coupons')
      .insert([
        {
          code: TEST_COUPON_CODE,
          discount_type: 'percentage',
          discount_value: 10,
          min_order_amount: 100,
          usage_limit: 2,
          used_count: 0,
          per_user_limit: 1,
          is_active: true
        }
      ])
      .select()
      .single();

    if (setupErr) {
      throw new Error(`Failed to create test coupon in DB: ${setupErr.message}`);
    }

    // -------------------------------------------------------------
    // TEST 1: High Concurrency Global Usage Limit (Race Condition Check)
    // Fire 10 simultaneous concurrent claims when usage_limit = 2
    // -------------------------------------------------------------
    console.log('\n--- Test 1: 10 Concurrent Claims on Coupon with usage_limit = 2 ---');
    const concurrentUsers = Array.from({ length: 10 }, (_, i) => `user_${i}_${Date.now()}`);

    const claimPromises = concurrentUsers.map((uid) =>
      couponModel.claimCouponAtomic(TEST_COUPON_CODE, uid)
    );

    const claimResults = await Promise.all(claimPromises);
    const successCount = claimResults.filter((r) => r.success).length;
    const failureCount = claimResults.filter((r) => !r.success).length;
    const limitExceededCount = claimResults.filter(
      (r) => !r.success && (r.error_code === 'LIMIT_EXCEEDED' || (r.message && r.message.includes('maximum global usage limit')))
    ).length;

    const { data: refreshedCoupon } = await supabase
      .from('coupons')
      .select('used_count')
      .eq('code', TEST_COUPON_CODE)
      .single();

    const usedCountInDb = Number(refreshedCoupon?.used_count || 0);

    const test1Passed =
      successCount === 2 &&
      failureCount === 8 &&
      limitExceededCount === 8 &&
      usedCountInDb === 2;

    logTest(
      'Global Usage Limit Strict Atomicity under 10 concurrent checkouts',
      test1Passed,
      `Success: ${successCount}/2, Failures: ${failureCount}/8 (Limit Exceeded: ${limitExceededCount}), DB used_count: ${usedCountInDb}`
    );

    // -------------------------------------------------------------
    // TEST 2: Further claims must be rejected once limit is reached
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Sequential Claim after Limit Reached ---');
    const extraClaim = await couponModel.claimCouponAtomic(TEST_COUPON_CODE, 'extra_user_99');
    const test2Passed = !extraClaim.success && (extraClaim.error_code === 'LIMIT_EXCEEDED' || extraClaim.message.includes('maximum global usage limit'));
    logTest(
      'Post-exhaustion Claim Rejection',
      test2Passed,
      `Expected failure with LIMIT_EXCEEDED, got: ${extraClaim.error_code || extraClaim.message}`
    );

    // -------------------------------------------------------------
    // TEST 3: Atomic Release / Rollback on Order Cancellation
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Atomic Release / Decrement on Cancellation ---');
    const release1 = await couponModel.releaseCouponAtomic(TEST_COUPON_CODE);
    const { data: afterRelease1 } = await supabase
      .from('coupons')
      .select('used_count')
      .eq('code', TEST_COUPON_CODE)
      .single();

    const countAfterRelease = Number(afterRelease1?.used_count || 0);
    const test3Passed = release1.success && countAfterRelease === 1;

    logTest(
      'Atomic Coupon Release (used_count decrements from 2 to 1)',
      test3Passed,
      `DB used_count after release: ${countAfterRelease} (Expected: 1)`
    );

    // Now that 1 slot was released, another claim must succeed!
    const slotReclaimed = await couponModel.claimCouponAtomic(TEST_COUPON_CODE, 'reclaim_user_1');
    const test3bPassed = slotReclaimed.success === true;
    logTest(
      'Re-claiming Released Slot succeeds',
      test3bPassed,
      `Claim after release returned success: ${slotReclaimed.success}`
    );

    // -------------------------------------------------------------
    // TEST 4: Clamped at 0 (Release cannot make used_count negative)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Clamping at 0 (Cannot decrement below 0) ---');
    // Release twice to bring to 0
    await couponModel.releaseCouponAtomic(TEST_COUPON_CODE);
    await couponModel.releaseCouponAtomic(TEST_COUPON_CODE);
    // Release a 3rd time
    const releaseBelowZero = await couponModel.releaseCouponAtomic(TEST_COUPON_CODE);
    const { data: zeroCoupon } = await supabase
      .from('coupons')
      .select('used_count')
      .eq('code', TEST_COUPON_CODE)
      .single();

    const countAtZero = Number(zeroCoupon?.used_count || 0);
    const test4Passed = countAtZero === 0;
    logTest(
      'Release Bounded at Zero (no negative count)',
      test4Passed,
      `DB used_count: ${countAtZero} (Expected: 0)`
    );

    // -------------------------------------------------------------
    // TEST 5: Per-User Usage Limit Check
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Per-User Usage Limit Enforcement ---');
    // Set per_user_limit to 1, usage_limit to 100
    await supabase.from('coupons').update({
      usage_limit: 100,
      used_count: 0,
      per_user_limit: 1,
      is_active: true
    }).eq('code', TEST_COUPON_CODE);

    // First claim by user A succeeds
    const userAClaim1 = await couponModel.claimCouponAtomic(TEST_COUPON_CODE, TEST_USER_A);
    const test5aPassed = userAClaim1.success === true;
    logTest(
      'First Claim by User A succeeds',
      test5aPassed,
      `Result: ${userAClaim1.success}`
    );

    // Simulate an order recorded for User A
    const { data: testOrder } = await supabase.from('orders').insert([
      {
        buyer_id: TEST_USER_A,
        coupon_code: TEST_COUPON_CODE,
        order_status: 'placed',
        payment_status: 'pending',
        subtotal: 500,
        total_amount: 450,
        recipient_name: 'Test Buyer',
        recipient_phone: '9999999999',
        delivery_address: 'Test Address Jaipur'
      }
    ]).select().single();

    // Second claim by User A must be rejected due to per_user_limit
    const userAClaim2 = await couponModel.claimCouponAtomic(TEST_COUPON_CODE, TEST_USER_A);
    const test5bPassed = !userAClaim2.success && (userAClaim2.error_code === 'USER_LIMIT_EXCEEDED' || userAClaim2.message.includes('maximum allowed usage limit'));
    logTest(
      'Second Claim by User A Blocked (per_user_limit: 1)',
      test5bPassed,
      `Expected failure with USER_LIMIT_EXCEEDED, got: ${userAClaim2.error_code || userAClaim2.message}`
    );

    // Clean up test order
    if (testOrder?.id) {
      await supabase.from('orders').delete().eq('id', testOrder.id);
    }

    // -------------------------------------------------------------
    // TEST 6: Inactive & Expired Coupon Validation & Claim Protection
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Inactive & Expired Coupons ---');
    // Set to inactive
    await supabase.from('coupons').update({ is_active: false }).eq('code', TEST_COUPON_CODE);
    const inactiveClaim = await couponModel.claimCouponAtomic(TEST_COUPON_CODE, 'user_inactive_test');
    const test6aPassed = !inactiveClaim.success && inactiveClaim.error_code === 'INACTIVE';
    logTest(
      'Inactive Coupon Claim Rejection',
      test6aPassed,
      `Result: ${inactiveClaim.error_code || inactiveClaim.message}`
    );

    // Set to active but expired
    await supabase.from('coupons').update({
      is_active: true,
      expiry_date: '2020-01-01'
    }).eq('code', TEST_COUPON_CODE);
    const expiredClaim = await couponModel.claimCouponAtomic(TEST_COUPON_CODE, 'user_expired_test');
    const test6bPassed = !expiredClaim.success && expiredClaim.error_code === 'EXPIRED';
    logTest(
      'Expired Coupon Claim Rejection',
      test6bPassed,
      `Result: ${expiredClaim.error_code || expiredClaim.message}`
    );

    // -------------------------------------------------------------
    // CLEANUP: Delete the test coupon
    // -------------------------------------------------------------
    console.log('\nCleaning up test coupon...');
    await supabase.from('coupons').delete().eq('code', TEST_COUPON_CODE);

  } catch (err) {
    console.error('❌ Test suite encountered unexpected error:', err);
    logTest('Test Suite Execution', false, err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 FINAL TEST SUITE REPORT');
  console.log('======================================================');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
  });
  console.log(`\nTotal: ${results.length} | Passed: ${results.filter((r) => r.passed).length} | Failed: ${results.filter((r) => !r.passed).length}`);
  console.log(`Status: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  console.log('======================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runTests();
