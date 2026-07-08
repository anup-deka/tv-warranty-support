-- Seed data: 10 sample TV devices with varied warranty statuses
-- Active, expiring soon, and expired warranties across different models

INSERT INTO devices (serial_code, customer_name, customer_email, tv_model, tv_screen_size, purchase_date, warranty_expiry_date, warranty_type, retailer)
VALUES
  ('SN-VISTA-2024-001', 'James Carter',    'james.carter@email.com',   'VistaClear 4K OLED X90',  '65"', '2024-03-15', '2027-03-15', 'Standard',  'BestBuy'),
  ('SN-VISTA-2023-002', 'Priya Nair',      'priya.nair@email.com',     'VistaClear 4K QLED Q70',  '55"', '2023-06-20', '2025-06-20', 'Standard',  'Amazon'),
  ('SN-NOVA-2022-003',  'Marcus Williams', 'marcus.w@email.com',       'NovaPic Ultra 8K Pro',    '75"', '2022-01-10', '2027-01-10', 'Extended',  'Costco'),
  ('SN-NOVA-2024-004',  'Aisha Thompson',  'aisha.t@email.com',        'NovaPic HD Smart 40',     '40"', '2024-11-01', '2025-11-01', 'Standard',  'Walmart'),
  ('SN-LUMA-2021-005',  'David Kim',       'david.kim@email.com',      'LumaBright OLED 77',      '77"', '2021-08-05', '2024-08-05', 'Standard',  'BestBuy'),
  ('SN-LUMA-2023-006',  'Sofia Reyes',     'sofia.reyes@email.com',    'LumaBright 4K HDR 50',    '50"', '2023-12-25', '2026-12-25', 'Standard',  'Target'),
  ('SN-VISTA-2022-007', 'Chen Wei',        'chen.wei@email.com',       'VistaClear QLED Q80',     '65"', '2022-04-18', '2027-04-18', 'Premium',   'BestBuy'),
  ('SN-NOVA-2023-008',  'Emily Johnson',   'emily.j@email.com',        'NovaPic Smart LED 32',    '32"', '2023-09-03', '2024-09-03', 'Standard',  'Amazon'),
  ('SN-LUMA-2024-009',  'Robert Patel',    'r.patel@email.com',        'LumaBright 4K OLED 55',   '55"', '2024-07-14', '2026-07-14', 'Standard',  'Costco'),
  ('SN-NOVA-2022-010',  'Nina Kovacs',     'nina.kovacs@email.com',    'NovaPic Ultra 4K 70',     '70"', '2022-10-30', '2027-10-30', 'Extended',  'Amazon')
ON CONFLICT (serial_code) DO NOTHING;
