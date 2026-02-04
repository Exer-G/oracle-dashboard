-- Scanned Data Table for Oracle Scanner Extension
-- Run this in Supabase SQL Editor

-- Create scanned_data table
CREATE TABLE IF NOT EXISTS scanned_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scan_id text UNIQUE NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    category text NOT NULL DEFAULT 'other',
    title text,
    url text,
    scanned_at timestamptz DEFAULT now(),
    processed_at timestamptz,
    client_id text,
    project_id text,
    notes text,
    content text,
    tables jsonb DEFAULT '[]',
    links jsonb DEFAULT '[]',
    metadata jsonb DEFAULT '{}',
    extracted_data jsonb DEFAULT '{}',
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'archived')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scanned_data_user_id ON scanned_data(user_id);
CREATE INDEX IF NOT EXISTS idx_scanned_data_category ON scanned_data(category);
CREATE INDEX IF NOT EXISTS idx_scanned_data_status ON scanned_data(status);
CREATE INDEX IF NOT EXISTS idx_scanned_data_scanned_at ON scanned_data(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanned_data_client_id ON scanned_data(client_id);

-- Enable RLS
ALTER TABLE scanned_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies (optimized with SELECT wrapper)
CREATE POLICY "Users can view own scanned data"
    ON scanned_data FOR SELECT
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own scanned data"
    ON scanned_data FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

CREATE POLICY "Users can update own scanned data"
    ON scanned_data FOR UPDATE
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own scanned data"
    ON scanned_data FOR DELETE
    USING (user_id = (SELECT auth.uid()));

-- Allow anonymous inserts (from extension before auth)
CREATE POLICY "Allow anonymous scanned data inserts"
    ON scanned_data FOR INSERT
    WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_scanned_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scanned_data_updated_at
    BEFORE UPDATE ON scanned_data
    FOR EACH ROW
    EXECUTE FUNCTION update_scanned_data_updated_at();

-- Add comment
COMMENT ON TABLE scanned_data IS 'Stores data captured by Oracle Scanner Chrome extension';
