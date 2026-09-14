-- ==========================================================
-- UNAIB COMPUTER ACCESSORIES - SQLite Database Schema
-- Embedded POS, Inventory, Purchases, Warranty & Ledgers
-- ==========================================================

PRAGMA foreign_keys = ON;

-- 1. User Access Control (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin TEXT, -- 4-digit quick PIN for cashier fast login
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Suppliers (Vendors / Distributors)
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    current_balance REAL DEFAULT 0.0, -- Positive means we owe supplier (Payable)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Inventory Products
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    cost_price REAL NOT NULL DEFAULT 0.0,
    sale_price REAL NOT NULL DEFAULT 0.0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    has_serials INTEGER DEFAULT 0, -- 1 if component requires serial numbers (e.g. SSD, GPU, RAM)
    warranty_months INTEGER DEFAULT 12, -- Default shop warranty duration in months
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    total_spent REAL DEFAULT 0.0,
    current_balance REAL DEFAULT 0.0, -- Positive means customer owes us (Receivable / Udhar)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Invoices (Sales Orders)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount_type TEXT DEFAULT 'amount', -- 'percentage' or 'amount'
    discount_value REAL DEFAULT 0.0,
    discount_amount REAL DEFAULT 0.0,
    tax_rate REAL DEFAULT 0.0,
    tax_amount REAL DEFAULT 0.0,
    grand_total REAL NOT NULL DEFAULT 0.0,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    change_amount REAL DEFAULT 0.0,
    balance_due REAL DEFAULT 0.0, -- Credit/Udhar amount if paid_amount < grand_total
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'card', 'online', 'credit', 'split'
    status TEXT DEFAULT 'completed', -- 'completed', 'refunded', 'cancelled'
    previous_customer_balance REAL DEFAULT 0.0,
    new_customer_balance REAL DEFAULT 0.0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Invoice Line Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0.0,
    unit_price REAL NOT NULL DEFAULT 0.0,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price REAL NOT NULL DEFAULT 0.0,
    warranty_months INTEGER DEFAULT 0
);

-- 8. Purchases (Stock Inward / Vendor Orders)
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_invoice_no TEXT,
    purchase_date DATE NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.0,
    discount REAL DEFAULT 0.0,
    tax_rate REAL DEFAULT 0.0,
    tax_amount REAL DEFAULT 0.0,
    grand_total REAL NOT NULL DEFAULT 0.0,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    balance_due REAL DEFAULT 0.0, -- Remaining payable debt to supplier
    previous_supplier_balance REAL DEFAULT 0.0,
    new_supplier_balance REAL DEFAULT 0.0,
    payment_method TEXT DEFAULT 'cash', -- 'cash', 'bank', 'credit'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Purchase Line Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0.0,
    sale_price REAL NOT NULL DEFAULT 0.0,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_cost REAL NOT NULL DEFAULT 0.0
);

-- 10. Double-Entry Party Ledgers (Khata / Udhar & Payables)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_type TEXT NOT NULL CHECK(party_type IN ('customer', 'supplier')),
    party_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL, -- 'sale_invoice', 'purchase_bill', 'payment_received', 'payment_made', 'adjustment'
    reference_id INTEGER,
    reference_no TEXT,
    debit REAL DEFAULT 0.0,   -- Customer: Sale invoice (+); Supplier: Payment made (-)
    credit REAL DEFAULT 0.0,  -- Customer: Payment received (-); Supplier: Purchase bill (+)
    balance REAL NOT NULL,    -- Running balance after transaction
    description TEXT,
    payment_method TEXT DEFAULT 'cash',
    entry_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Serial Numbers & Warranty Records
CREATE TABLE IF NOT EXISTS serial_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'in_stock', -- 'in_stock', 'sold', 'rma_claimed', 'returned'
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    invoice_item_id INTEGER REFERENCES invoice_items(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sold_date DATETIME,
    warranty_expiry_date DATETIME,
    vendor_warranty_expiry DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Warranty Claims & RMA Tracking
CREATE TABLE IF NOT EXISTS warranty_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_number TEXT UNIQUE NOT NULL,
    serial_number_id INTEGER NOT NULL REFERENCES serial_numbers(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    issue_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent_to_vendor', 'repaired', 'replaced', 'rejected'
    resolution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- 13. Operational Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    description TEXT,
    expense_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Cash Drawer Shifts & Reconciliation
CREATE TABLE IF NOT EXISTS cash_drawers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    opening_cash REAL NOT NULL DEFAULT 0.0,
    cash_sales REAL DEFAULT 0.0,
    cash_expenses REAL DEFAULT 0.0,
    expected_closing_cash REAL DEFAULT 0.0,
    actual_closing_cash REAL,
    discrepancy REAL,
    status TEXT DEFAULT 'open',
    notes TEXT
);

-- 15. Store Settings
CREATE TABLE IF NOT EXISTS store_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_sn ON serial_numbers(serial_number);
CREATE INDEX IF NOT EXISTS idx_invoices_num ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchases_num ON purchases(purchase_number);
CREATE INDEX IF NOT EXISTS idx_ledger_party ON ledger_entries(party_type, party_id);
