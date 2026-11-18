-- ==============================================================================
-- DIGITAL INDIA PROJECT — CLOUDFLARE D1 DATABASE MIGRATION
-- Migration Version: 0001_initial_schema.sql
-- Covers all 25 core relational tables with indexes, foreign keys & timestamps
-- ==============================================================================

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    password_hash TEXT,
    avatar_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 2. roles
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. permissions
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 5. service_categories
CREATE TABLE IF NOT EXISTS service_categories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_hi TEXT,
    description TEXT,
    icon_name TEXT,
    badge_color TEXT,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. services
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_hi TEXT,
    short_desc TEXT NOT NULL,
    short_desc_hi TEXT,
    full_desc TEXT NOT NULL,
    icon_name TEXT,
    service_charge INTEGER NOT NULL DEFAULT 0,
    govt_fees INTEGER NOT NULL DEFAULT 0,
    estimated_time TEXT,
    is_popular INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES service_categories(id)
);

-- 7. service_forms
CREATE TABLE IF NOT EXISTS service_forms (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    title TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- 8. form_fields
CREATE TABLE IF NOT EXISTS form_fields (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    label_hi TEXT,
    field_type TEXT NOT NULL,
    placeholder TEXT,
    is_required INTEGER DEFAULT 0,
    options_json TEXT,
    validation_regex TEXT,
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (form_id) REFERENCES service_forms(id) ON DELETE CASCADE
);

-- 9. applications
CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY, -- e.g. DIP-2026-78412
    user_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Submitted',
    assigned_operator_id TEXT,
    form_data_json TEXT NOT NULL,
    customer_remarks TEXT,
    internal_notes TEXT,
    completion_file_name TEXT,
    completion_file_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (assigned_operator_id) REFERENCES users(id)
);

-- 10. application_documents
CREATE TABLE IF NOT EXISTS application_documents (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    r2_storage_key TEXT NOT NULL,
    verification_status TEXT DEFAULT 'Pending',
    rejection_reason TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- 11. application_status_history
CREATE TABLE IF NOT EXISTS application_status_history (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    updated_by_user_id TEXT NOT NULL,
    customer_message TEXT,
    internal_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

-- 12. payments
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    application_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cf_payment_id TEXT,
    amount INTEGER NOT NULL,
    govt_fee INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Initiated',
    payment_method TEXT,
    webhook_signature TEXT,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 13. invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    payment_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    gst_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 14. notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL, -- email, sms, whatsapp, in_app
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. notification_templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY,
    event_key TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL,
    subject_template TEXT,
    body_template TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- 16. support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    application_id TEXT,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'Open',
    priority TEXT DEFAULT 'Medium',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (application_id) REFERENCES applications(id)
);

-- 17. support_messages
CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- 18. admin_activity_logs
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. website_settings
CREATE TABLE IF NOT EXISTS website_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 20. faqs
CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    service_id TEXT,
    question TEXT NOT NULL,
    question_hi TEXT,
    answer TEXT NOT NULL,
    answer_hi TEXT,
    display_order INTEGER DEFAULT 0
);

-- 21. knowledge_base
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 22. coupons
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_amount INTEGER NOT NULL,
    min_order_amount INTEGER DEFAULT 0,
    valid_until DATETIME,
    is_active INTEGER DEFAULT 1
);

-- 23. refunds
CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    initiated_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- 24. user_sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 25. audit_events
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    user_id TEXT,
    payload_json TEXT,
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);
