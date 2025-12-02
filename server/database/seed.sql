-- Seed Data for CreativeProcess Caller
-- Run this to populate the database with sample data

-- Get admin user ID
DO $$
DECLARE
    admin_id UUID;
    list_id UUID;
BEGIN
    -- Get admin user
    SELECT id INTO admin_id FROM users WHERE email = 'admin@creativeprocess.io' LIMIT 1;
    
    IF admin_id IS NULL THEN
        RAISE NOTICE 'Admin user not found, creating one...';
        INSERT INTO users (email, password, first_name, last_name, role)
        VALUES ('admin@creativeprocess.io', '$2b$10$rZJ3qGHCpXBXXOw8QE3Ziu9WXMhvVv5P0zK3qKqWqXQbXqXqXqXq', 'Admin', 'User', 'admin')
        RETURNING id INTO admin_id;
    END IF;

    -- Insert sample prospects
    INSERT INTO prospects (first_name, last_name, company, title, phone, email, status, timezone, notes, created_by) VALUES
    ('John', 'Smith', 'Acme Corporation', 'CEO', '5551234567', 'john.smith@acme.com', 'New', 'America/New_York', 'Key decision maker', admin_id),
    ('Sarah', 'Johnson', 'TechStart Inc', 'VP Sales', '5552345678', 'sarah.j@techstart.com', 'New', 'America/Los_Angeles', 'Interested in enterprise plan', admin_id),
    ('Michael', 'Brown', 'Global Solutions', 'Director', '5553456789', 'm.brown@globalsol.com', 'Contacted', 'America/Chicago', 'Follow up next week', admin_id),
    ('Emily', 'Davis', 'Innovation Labs', 'CTO', '5554567890', 'emily.d@innovlabs.com', 'New', 'America/Denver', 'Technical buyer', admin_id),
    ('Robert', 'Wilson', 'Enterprise Co', 'Manager', '5555678901', 'r.wilson@enterprise.co', 'Qualified', 'America/New_York', 'Ready for demo', admin_id),
    ('Jennifer', 'Taylor', 'StartupXYZ', 'Founder', '5556789012', 'jen@startupxyz.com', 'New', 'America/Los_Angeles', 'Early stage company', admin_id),
    ('David', 'Anderson', 'BigCorp Ltd', 'VP Marketing', '5557890123', 'd.anderson@bigcorp.com', 'Contacted', 'America/Chicago', 'Needs budget approval', admin_id),
    ('Lisa', 'Thomas', 'MedTech Solutions', 'COO', '5558901234', 'lisa.t@medtech.com', 'New', 'America/New_York', 'Healthcare vertical', admin_id),
    ('James', 'Martinez', 'FinServ Inc', 'Director', '5559012345', 'j.martinez@finserv.com', 'Qualified', 'America/Denver', 'High priority', admin_id),
    ('Amanda', 'Garcia', 'RetailMax', 'CEO', '5550123456', 'amanda.g@retailmax.com', 'New', 'America/Los_Angeles', 'Multi-location retail', admin_id),
    ('Christopher', 'Lee', 'CloudFirst', 'CTO', '5551112222', 'c.lee@cloudfirst.io', 'New', 'America/New_York', 'Cloud native company', admin_id),
    ('Michelle', 'White', 'DataDriven Co', 'VP Analytics', '5552223333', 'm.white@datadriven.co', 'Contacted', 'America/Chicago', 'Analytics focus', admin_id),
    ('Daniel', 'Harris', 'SecureNet', 'CISO', '5553334444', 'd.harris@securenet.com', 'New', 'America/Denver', 'Security requirements', admin_id),
    ('Jessica', 'Clark', 'EduTech Learn', 'Director', '5554445555', 'j.clark@edutech.com', 'New', 'America/Los_Angeles', 'Education sector', admin_id),
    ('Matthew', 'Lewis', 'ManufactureX', 'Plant Manager', '5555556666', 'm.lewis@manufacturex.com', 'Qualified', 'America/New_York', 'Manufacturing vertical', admin_id),
    ('Ashley', 'Robinson', 'GreenEnergy', 'CEO', '5556667777', 'a.robinson@greenenergy.com', 'New', 'America/Chicago', 'Sustainability focus', admin_id),
    ('Andrew', 'Walker', 'LogiFlow', 'VP Operations', '5557778888', 'a.walker@logiflow.com', 'Contacted', 'America/Denver', 'Logistics company', admin_id),
    ('Stephanie', 'Hall', 'HealthPlus', 'CMO', '5558889999', 's.hall@healthplus.com', 'New', 'America/Los_Angeles', 'Healthcare marketing', admin_id),
    ('Joshua', 'Allen', 'FoodService Pro', 'Owner', '5559990000', 'j.allen@foodservicepro.com', 'New', 'America/New_York', 'Restaurant group', admin_id),
    ('Nicole', 'Young', 'TravelMax', 'VP Sales', '5550001111', 'n.young@travelmax.com', 'Qualified', 'America/Chicago', 'Travel industry', admin_id)
    ON CONFLICT (phone) DO NOTHING;

    -- Create a sample lead list
    INSERT INTO lead_lists (name, description, created_by)
    VALUES ('Hot Prospects', 'High priority leads ready for outreach', admin_id)
    RETURNING id INTO list_id;

    -- Add some prospects to the lead list
    INSERT INTO lead_list_members (list_id, prospect_id)
    SELECT list_id, id FROM prospects WHERE status IN ('Qualified', 'New') LIMIT 10
    ON CONFLICT DO NOTHING;

    -- Create another lead list
    INSERT INTO lead_lists (name, description, created_by)
    VALUES ('Follow Up Required', 'Prospects that need follow up calls', admin_id)
    RETURNING id INTO list_id;

    -- Add contacted prospects to this list
    INSERT INTO lead_list_members (list_id, prospect_id)
    SELECT list_id, id FROM prospects WHERE status = 'Contacted'
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Seed data inserted successfully!';
END $$;

-- Show counts
SELECT 'Prospects' as table_name, COUNT(*) as count FROM prospects
UNION ALL
SELECT 'Lead Lists', COUNT(*) FROM lead_lists
UNION ALL
SELECT 'Lead List Members', COUNT(*) FROM lead_list_members
UNION ALL
SELECT 'Users', COUNT(*) FROM users;
