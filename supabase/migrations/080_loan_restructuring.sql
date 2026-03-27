-- 080: Loan restructuring (moderator rule)
-- Options: 25%, 50%, 75%, 100% defer first repayment
-- Extra interest: 2.5%, 5%, 7.5%, 10% based on defer %
-- Only allowed in first season after loan (before any repayment)

ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_1 INTEGER;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_2 INTEGER;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_3 INTEGER;

COMMENT ON COLUMN loans.repayment_1 IS 'First installment amount (after restructure)';
COMMENT ON COLUMN loans.repayment_2 IS 'Second installment amount';
COMMENT ON COLUMN loans.repayment_3 IS 'Third installment amount';

-- Backfill existing loans with default schedule
UPDATE loans SET
  repayment_1 = repay_total / 3,
  repayment_2 = repay_total / 3,
  repayment_3 = repay_total - (repay_total / 3) * 2
WHERE repayment_1 IS NULL AND remaining > 0;

-- RPC: Confirm loan restructure
CREATE OR REPLACE FUNCTION restructure_loan(p_loan_id UUID, p_restructure_pct INTEGER, p_actor_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_loan RECORD;
  v_league_season INTEGER;
  v_base_installment INTEGER;
  v_first_reduced INTEGER;
  v_deferred INTEGER;
  v_extra_interest INTEGER;
  v_extra_rate NUMERIC;
  v_spread INTEGER;
  v_r2 INTEGER;
  v_r3 INTEGER;
BEGIN
  IF p_restructure_pct NOT IN (25, 50, 75, 100) THEN
    RETURN json_build_object('success', false, 'error', 'restructure_pct must be 25, 50, 75, or 100');
  END IF;

  SELECT l.* INTO v_loan
  FROM loans l
  WHERE l.id = p_loan_id;

  IF v_loan IS NOT NULL AND v_loan.league_id IS NOT NULL THEN
    SELECT season INTO v_league_season FROM leagues WHERE id = v_loan.league_id;
  END IF;

  IF v_loan IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Loan not found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_loan.team_id AND user_id = p_actor_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not your loan');
  END IF;

  IF v_loan.repay_made > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Restructure only allowed before first repayment');
  END IF;

  IF v_loan.restructure_confirmed THEN
    RETURN json_build_object('success', false, 'error', 'Loan already restructured');
  END IF;

  IF v_league_season != v_loan.season_taken THEN
    RETURN json_build_object('success', false, 'error', 'Restructure only allowed in first season after loan');
  END IF;

  v_extra_rate := CASE p_restructure_pct
    WHEN 25 THEN 0.025
    WHEN 50 THEN 0.05
    WHEN 75 THEN 0.075
    WHEN 100 THEN 0.1
    ELSE 0.025
  END;

  v_base_installment := v_loan.repay_total / 3;
  v_first_reduced := (v_base_installment * (100 - p_restructure_pct) / 100)::INTEGER;
  v_deferred := v_base_installment - v_first_reduced;
  v_extra_interest := (v_loan.amount * (p_restructure_pct / 100.0) * v_extra_rate)::INTEGER;
  v_spread := (v_deferred + v_extra_interest) / 2;
  v_r2 := v_base_installment + v_spread;
  v_r3 := v_base_installment + (v_deferred + v_extra_interest - v_spread);

  UPDATE loans SET
    restructure_pct = p_restructure_pct,
    restructure_confirmed = true,
    repayment_1 = v_first_reduced,
    repayment_2 = v_r2,
    repayment_3 = v_r3,
    repay_total = v_first_reduced + v_r2 + v_r3,
    remaining = v_first_reduced + v_r2 + v_r3,
    updated_at = NOW()
  WHERE id = p_loan_id;

  RETURN json_build_object(
    'success', true,
    'repayment_1', v_first_reduced,
    'repayment_2', v_r2,
    'repayment_3', v_r3,
    'new_total', v_first_reduced + v_r2 + v_r3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
