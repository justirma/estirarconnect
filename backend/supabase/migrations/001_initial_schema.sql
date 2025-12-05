-- Create seniors table
CREATE TABLE seniors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  language VARCHAR(10) NOT NULL CHECK (language IN ('en', 'es')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- Create videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  youtube_url VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100),
  language VARCHAR(10) NOT NULL CHECK (language IN ('en', 'es')),
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create logs table
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  reply_text TEXT,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_seniors_phone ON seniors(phone_number);
CREATE INDEX idx_logs_senior_id ON logs(senior_id);
CREATE INDEX idx_logs_sent_at ON logs(sent_at);
CREATE INDEX idx_videos_language ON videos(language);
CREATE INDEX idx_videos_sequence ON videos(sequence_order);

-- Add comments for documentation
COMMENT ON TABLE seniors IS 'Stores senior recipients information';
COMMENT ON TABLE videos IS 'Stores chair exercise video metadata';
COMMENT ON TABLE logs IS 'Logs all message sends and replies';
