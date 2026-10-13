-- Read-only, service-role-only aggregation of archived Starlink minute data.
-- The Edge Function starlink-history-vault authenticates the private capability
-- and supplies its resolved monitor UUID. Browsers never receive the UUID or
-- any database credential, and anon/authenticated cannot execute this RPC.
CREATE OR REPLACE FUNCTION public.starlink_archive_analytics(
  p_monitor uuid,
  p_from bigint,
  p_to bigint,
  p_grain text DEFAULT 'day'
)
RETURNS TABLE (
  bucket bigint,
  recorded_minutes bigint,
  sampled_seconds bigint,
  download_gb double precision,
  upload_gb double precision,
  energy_kwh double precision,
  peak_minute_mbps double precision
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT (
    CASE
      WHEN p_grain = 'hour' THEN (m.minute / 3600) * 3600
      WHEN p_grain = 'week' THEN ((m.minute + 259200) / 604800) * 604800 - 259200
      ELSE (m.minute / 86400) * 86400
    END
  )::bigint,
  count(*)::bigint,
  sum(least(m.samples::int, 60))::bigint,
  sum(m.downlink_bits) / 8e9,
  sum(m.uplink_bits) / 8e9,
  sum(m.watt_seconds) / 3600000,
  max((coalesce(m.downlink_bits, 0) + coalesce(m.uplink_bits, 0)) / 60e6)
  FROM public.starlink_archive_minutes m
  WHERE m.monitor_id = p_monitor
    AND m.minute >= p_from
    AND m.minute < p_to
    AND p_grain IN ('hour', 'day', 'week')
    AND p_from >= 0
    AND p_to > p_from
    AND p_to - p_from <= 5 * 366 * 86400
  GROUP BY 1
  ORDER BY 1
$$;

REVOKE ALL ON FUNCTION public.starlink_archive_analytics(uuid, bigint, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.starlink_archive_analytics(uuid, bigint, bigint, text)
  TO service_role;
