-- SAFER 247 development-only synthetic records. Never execute against production.
-- Prerequisites: migration 0008, Demo operator created with seed_demo.py.
-- Run through psql -v ON_ERROR_STOP=1 -f backend/database/seed_demo.sql
BEGIN;
DO $$
DECLARE
    demo_id uuid;
    unit_id uuid;
    message_id uuid;
    report_id uuid;
    category_id bigint;
    barangay_id bigint;
    categories text[] := ARRAY['Flood','Fire','Medical','Vehicular Accident','Landslide','Rescue'];
    places text[] := ARRAY['Halapitan','Kawayan','Namnam','Kalagangan','Little Baguio','Cabuling',
                           'Bonacao','Mabuhay','Kibongcog','Nacabuklad','Tugop','Dao'];
    incident_category text;
    barangay_name text;
    n integer;
    latitude double precision;
    longitude double precision;
    reported timestamptz;
BEGIN
    SELECT id INTO demo_id FROM operators WHERE username = 'Demo' AND is_approved = true AND role = 'viewer';
    IF demo_id IS NULL THEN
        RAISE EXCEPTION 'Create the approved viewer-only Demo operator using seed_demo first.';
    END IF;
    IF EXISTS(SELECT 1 FROM incident_reports WHERE report_code = 'DEMO-0001') THEN
        RAISE NOTICE 'Synthetic dataset already exists; skipping reseed.';
        RETURN;
    END IF;
    FOR n IN 1..120 LOOP
        incident_category := categories[1 + ((n - 1) % array_length(categories, 1))];
        barangay_name := places[1 + ((n - 1) % array_length(places, 1))];
        INSERT INTO incident_types (name) VALUES (incident_category)
          ON CONFLICT (name) DO NOTHING;
        SELECT id INTO category_id FROM incident_types WHERE name = incident_category;
        INSERT INTO barangays (name) VALUES (barangay_name)
          ON CONFLICT (name) DO NOTHING;
        SELECT id INTO barangay_id FROM barangays WHERE name = barangay_name;
        INSERT INTO responders (call_sign, display_name)
          VALUES ('DEMO-UNIT-' || (((n - 1) % 8) + 1), 'Synthetic Responder ' || (((n - 1) % 8) + 1))
          ON CONFLICT (call_sign) DO NOTHING;
        SELECT id INTO unit_id FROM responders WHERE call_sign = 'DEMO-UNIT-' || (((n - 1) % 8) + 1);
        -- Plausible varying samples around the municipality, NOT verified incident coordinates.
        latitude := 7.75 + (n % 16) * 0.011;
        longitude := 125.28 + (n % 12) * 0.010;
        reported := now() - make_interval(hours => n * 4);
        message_id := gen_random_uuid();
        INSERT INTO messages(id, direction, sender_responder_id, body, received_at,
                             transmission_status, created_at, sample_owner_operator_id)
        VALUES (message_id, 'incoming', unit_id,
                '[SYNTHETIC DATA] ' || incident_category || ' observation near ' || barangay_name,
                reported, 'received', reported, demo_id);
        INSERT INTO incident_reports (
            id, report_code, source_message_id, incident_type_id, responder_id, barangay_id,
            location_description, details, location, status, reported_at, sample_owner_operator_id
        ) VALUES (
            gen_random_uuid(), 'DEMO-' || lpad(n::text, 4, '0'), message_id, category_id, unit_id,
            barangay_id, 'Synthetic sample location, ' || barangay_name,
            '[SYNTHETIC DATA] Training-only ' || incident_category || ' report number ' || n ||
            '. Do not treat this report as an emergency.',
            ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography,
            (ARRAY['received','monitoring','resolved','closed','pending_image'])[1 + ((n - 1) % 5)],
            reported, demo_id
        );
    END LOOP;
    FOR n IN 1..60 LOOP
        INSERT INTO messages(id, direction, sender_operator_id, body, sent_at,
                             transmission_status, sample_owner_operator_id)
        VALUES(gen_random_uuid(), 'outgoing', demo_id,
               '[SYNTHETIC DATA] Training-only command center check-in ' || n,
               now() - make_interval(hours => n * 3),
               (ARRAY['audio_complete','delivery_unknown','failed','queued'])[1 + (n % 4)],
               demo_id);
    END LOOP;
    RAISE NOTICE 'Added 120 synthetic incidents, 120 incoming messages, and 60 outgoing messages for Demo only.';
END $$;
COMMIT;
