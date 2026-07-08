-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Registered devices with warranty info
CREATE TABLE IF NOT EXISTS devices (
    serial_code         VARCHAR(64) PRIMARY KEY,
    customer_name       VARCHAR(128) NOT NULL,
    customer_email      VARCHAR(256) NOT NULL,
    tv_model            VARCHAR(128) NOT NULL,
    tv_screen_size      VARCHAR(16),
    purchase_date       DATE NOT NULL,
    warranty_expiry_date DATE NOT NULL,
    warranty_type       VARCHAR(32) NOT NULL DEFAULT 'Standard',  -- Standard, Extended, Premium
    retailer            VARCHAR(128),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chunks of the warranty policy document + their embeddings
CREATE TABLE IF NOT EXISTS policy_chunks (
    id              SERIAL PRIMARY KEY,
    section_title   VARCHAR(256),
    content         TEXT NOT NULL,
    embedding       vector(1536),
    chunk_index     INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS policy_chunks_embedding_idx
    ON policy_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);

-- Chat conversations tied to a serial code
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_code VARCHAR(64) NOT NULL REFERENCES devices(serial_code) ON DELETE CASCADE,
    messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_code     VARCHAR(64) NOT NULL REFERENCES devices(serial_code) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    title           VARCHAR(256) NOT NULL,
    description     TEXT NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'open',   -- open, in_progress, resolved, closed
    priority        VARCHAR(16) NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_serial_code_idx ON tickets(serial_code);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
