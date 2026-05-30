-- Function to calculate total revenue to prevent fetching all payment rows into memory
CREATE OR REPLACE FUNCTION get_total_revenue()
RETURNS json AS $$
DECLARE
  total_inr bigint;
  total_stars bigint;
BEGIN
  SELECT
    COALESCE(SUM(amount_inr), 0),
    COALESCE(SUM(amount_stars), 0)
  INTO total_inr, total_stars
  FROM payments
  WHERE status = 'success';

  RETURN json_build_object(
    'inr', total_inr / 100.0,
    'stars', total_stars
  );
END;
$$ LANGUAGE plpgsql;
