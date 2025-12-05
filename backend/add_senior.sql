-- Add Irma's WhatsApp number
INSERT INTO seniors (phone_number, language, active)
VALUES ('+13055629885', 'es', true)
ON CONFLICT (phone_number) DO UPDATE
SET language = 'es', active = true;
