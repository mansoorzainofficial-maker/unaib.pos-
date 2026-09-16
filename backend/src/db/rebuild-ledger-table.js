const { getDb } = require('../config/db');
const db = getDb();

db.exec(`
BEGIN TRANSACTION;

CREATE TABLE ledger_entries_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_type TEXT NOT NULL CHECK(party_type IN ('supplier', 'client', 'customer')),
    party_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL,
    reference_id INTEGER,
    reference_no TEXT,
    debit REAL NOT NULL DEFAULT 0.0,
    credit REAL NOT NULL DEFAULT 0.0,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description TEXT,
    entry_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ledger_entries_new (
    id, party_type, party_id, entry_type, reference_id, reference_no,
    debit, credit, account_id, description, entry_date, created_at
)
SELECT 
    id, party_type, party_id, entry_type, reference_id, reference_no,
    debit, credit, account_id, description, entry_date, created_at
FROM ledger_entries;

DROP TABLE ledger_entries;

ALTER TABLE ledger_entries_new RENAME TO ledger_entries;

CREATE INDEX IF NOT EXISTS idx_ledger_party_search ON ledger_entries(party_type, party_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger_entries(reference_id, entry_type);

COMMIT;
`);

console.log('Successfully rebuilt ledger_entries without balance column!');
