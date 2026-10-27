-- Add is_system flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_users_is_system ON users (is_system);

-- Create system_audit_logs table
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150) NOT NULL,
    user_email VARCHAR(150),
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    description VARCHAR(500),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_company_created ON system_audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_company_entity ON system_audit_logs (company_id, entity_name);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_company_action ON system_audit_logs (company_id, action);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_company_user ON system_audit_logs (company_id, user_id);
