-- Migration 026: Atomic Coupon Claim and Release Stored Procedures
-- Solves Race Condition (M3): Enforces strict atomic locks on coupon usage_limit and per_user_limit

-- 1. claim_coupon_atomic: Atomically checks limits and increments used_count
CREATE OR REPLACE FUNCTION claim_coupon_atomic(
    p_code TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coupon RECORD;
    v_user_usage_count INT := 0;
    v_now TIMESTAMPTZ := NOW();
    v_clean_code TEXT;
BEGIN
    v_clean_code := UPPER(TRIM(p_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_CODE', 'message', 'Please provide a coupon code.');
    END IF;

    -- Lock the coupon row FOR UPDATE to serialize all concurrent claims for this coupon code
    SELECT * INTO v_coupon
    FROM coupons
    WHERE UPPER(TRIM(code)) = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Coupon not found.');
    END IF;

    -- Check if active
    IF v_coupon.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INACTIVE', 'message', format('Coupon "%s" is currently disabled or inactive.', v_coupon.code));
    END IF;

    -- Check expiry date
    IF v_coupon.expiry_date IS NOT NULL AND v_coupon.expiry_date < v_now::date THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'EXPIRED', 'message', format('Coupon "%s" has expired.', v_coupon.code));
    END IF;

    -- Check global usage limit strictly
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_limit > 0 THEN
        IF COALESCE(v_coupon.used_count, 0) >= v_coupon.usage_limit THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'LIMIT_EXCEEDED',
                'message', format('Coupon "%s" has reached its maximum global usage limit of %s.', v_coupon.code, v_coupon.usage_limit),
                'used_count', COALESCE(v_coupon.used_count, 0),
                'usage_limit', v_coupon.usage_limit
            );
        END IF;
    END IF;

    -- Check per-user limit strictly
    IF p_user_id IS NOT NULL AND v_coupon.per_user_limit IS NOT NULL AND v_coupon.per_user_limit > 0 THEN
        SELECT COUNT(*) INTO v_user_usage_count
        FROM orders
        WHERE buyer_id = p_user_id
          AND UPPER(TRIM(coupon_code)) = v_clean_code
          AND order_status NOT IN ('cancelled', 'awaiting_payment');

        IF v_user_usage_count >= v_coupon.per_user_limit THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'USER_LIMIT_EXCEEDED',
                'message', format('You have reached the maximum allowed usage limit (%s) for coupon "%s".', v_coupon.per_user_limit, v_coupon.code),
                'per_user_limit', v_coupon.per_user_limit
            );
        END IF;
    END IF;

    -- Check first order only rule
    IF p_user_id IS NOT NULL AND v_coupon.first_order_only IS TRUE THEN
        SELECT COUNT(*) INTO v_user_usage_count
        FROM orders
        WHERE buyer_id = p_user_id
          AND order_status NOT IN ('cancelled', 'awaiting_payment');

        IF v_user_usage_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'FIRST_ORDER_ONLY',
                'message', format('Coupon "%s" is only valid for your first order.', v_coupon.code)
            );
        END IF;
    END IF;

    -- All checks passed! Atomically increment used_count
    UPDATE coupons
    SET used_count = COALESCE(used_count, 0) + 1
    WHERE id = v_coupon.id;

    RETURN jsonb_build_object(
        'success', true,
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'used_count', COALESCE(v_coupon.used_count, 0) + 1,
        'usage_limit', v_coupon.usage_limit,
        'discount_type', v_coupon.discount_type,
        'discount_value', v_coupon.discount_value
    );
END;
$$;

-- 2. release_coupon_atomic: Atomically decrements used_count when an order is cancelled
CREATE OR REPLACE FUNCTION release_coupon_atomic(
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coupon RECORD;
    v_clean_code TEXT;
    v_new_count INT;
BEGIN
    v_clean_code := UPPER(TRIM(p_code));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid coupon code.');
    END IF;

    SELECT * INTO v_coupon
    FROM coupons
    WHERE UPPER(TRIM(code)) = v_clean_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Coupon not found.');
    END IF;

    v_new_count := GREATEST(0, COALESCE(v_coupon.used_count, 0) - 1);

    UPDATE coupons
    SET used_count = v_new_count
    WHERE id = v_coupon.id;

    RETURN jsonb_build_object(
        'success', true,
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'used_count', v_new_count
    );
END;
$$;
