-- Seed data for QuantLens AI (Foundation Setup)

-- Insert Demo User: demo@quantlens.ai / password123
-- Bcrypt hash for 'password123'
INSERT INTO users (email, hashed_password, full_name, is_active)
VALUES (
    'demo@quantlens.ai',
    '$2b$12$EixZaYVK1fsAH1rf4zXXJeqUj3TAd7tM2.vLgl69xJ/y.eWj8C1N2',
    'Demo Investor',
    TRUE
) ON CONFLICT (email) DO NOTHING;
