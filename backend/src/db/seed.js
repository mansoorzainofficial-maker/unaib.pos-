const { getDb } = require('../config/db');
const { hashPassword } = require('../utils/authUtils');

function seed() {
  const db = getDb();
  console.log('Seeding initial data for Unaib Computer Accessories...');

  // 1. Initial Users (Admin & Cashier)
  const adminPass = hashPassword('admin123');
  const cashierPass = hashPassword('cashier123');

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, pin, full_name, role, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(1, 'admin', '81d9c2c23641456e33ad3468ade1ba44:16805866b0baa649696180f20d18fddfabcefc6f1cc3aecbfe1110c9875a36cd12f12992e2814d1001c9f886746d6fc91588e3c5b138973d99b2ed66d11a1dc8', '5094', 'Unaib Store Admin', 'admin', '+92 300 9258123');
  insertUser.run(2, 'cashier1', cashierPass, '1111', 'Muhammad Ali (Cashier)', 'cashier', '+92 321 4455667');

  // 2. Initial Categories
  const categories = [
    { id: 1, name: 'Keyboards & Mice', desc: 'Mechanical keyboards, gaming mice, mouse pads' },
    { id: 2, name: 'Storage & SSDs', desc: 'NVMe M.2 SSDs, SATA SSDs, External Hard Drives' },
    { id: 3, name: 'Graphics Cards', desc: 'NVIDIA GeForce & AMD Radeon GPUs' },
    { id: 4, name: 'RAM & Memory', desc: 'DDR4 and DDR5 Desktop & Laptop RAM' },
    { id: 5, name: 'Power Supplies', desc: 'Bronze, Gold modular and non-modular PSUs' },
    { id: 6, name: 'Cables & Adapters', desc: 'HDMI, DisplayPort, Type-C, Ethernet, Power cables' },
    { id: 7, name: 'Coolers & Fans', desc: 'ARGB Case fans, CPU Air & Liquid Coolers' },
    { id: 8, name: 'Audio & Headsets', desc: 'Gaming headsets, USB microphones, soundcards' }
  ];

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, description)
    VALUES (?, ?, ?)
  `);
  categories.forEach(c => insertCategory.run(c.id, c.name, c.desc));

  // 3. Default Store Settings
  const settings = [
    { key: 'store_name', value: 'Unaib Computer Accessories' },
    { key: 'store_tagline', value: 'Gaming Rigs, High-End Components & Genuine Accessories' },
    { key: 'store_address', value: 'Shop #14, Ground Floor, Techno City Plaza, I.I. Chundrigar Rd, Karachi' },
    { key: 'store_phone', value: '+92 300 9258123 / 021-32278910' },
    { key: 'store_email', value: 'sales@unaibcomputers.com' },
    { key: 'currency_symbol', value: 'Rs.' },
    { key: 'tax_rate', value: '0' },
    { key: 'receipt_size', value: 'a4' }, // a4, a5, 80mm, or 58mm
    { key: 'receipt_footer', value: 'Warranty Terms: 7 days check warranty for unsealed items. 1-2 year brand warranty for serialized components. Physical/burn damage voids warranty.' },
    { key: 'invoice_prefix', value: 'UCA' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO store_settings (key, value)
    VALUES (?, ?)
  `);
  settings.forEach(s => insertSetting.run(s.key, s.value));

  // 4. Default Cash Counter Account
  try {
    const insertAccount = db.prepare(`
      INSERT OR IGNORE INTO accounts (id, name, type, is_default, current_balance)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAccount.run(1, 'کیش کاؤنٹر (Cash Counter)', 'cash', 1, 0.0);
  } catch (_) {}

  // 5. Zero demo products, zero demo suppliers, zero fake balances seeded.
  // The client will create their own products via GRN and inventory.
  console.log('Production clean template initialized successfully (0 products, 0 dummy data)!');
}

module.exports = { seed };
