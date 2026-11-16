-- ==============================================================================
-- 📜 AUDIT LOGS TABLE & POLICIES (SUPABASE SQL SCRIPT)
-- Records all critical admin modifications (Products, Orders, Categories, Banners, Auth)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('audit_log_' || substr(md5(random()::text), 1, 8)),
    admin_id TEXT,
    action TEXT NOT NULL,
    table_affected TEXT,
    record_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-performance timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_affected ON public.audit_logs (table_affected);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow backend API operations
DROP POLICY IF EXISTS "Allow backend API access to audit_logs" ON public.audit_logs;
CREATE POLICY "Allow backend API access to audit_logs" 
ON public.audit_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);
