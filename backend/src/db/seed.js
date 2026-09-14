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

  insertUser.run(1, 'admin', adminPass, '1234', 'Unaib Store Admin', 'admin', '+92 300 9258123');
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

  // 3. Initial Suppliers
  const suppliers = [
    { id: 1, name: 'Apex Tech Distributors', person: 'Hamza Malik', phone: '0321-5551234', email: 'sales@apextech.pk', address: 'Techno City Karachi' },
    { id: 2, name: 'Global Silicon Importers', person: 'Bilal Ahmed', phone: '0300-8889911', email: 'bilal@globalsilicon.com', address: 'Hafeez Center Lahore' },
    { id: 3, name: 'NexGen Accessories Hub', person: 'Tariq Mehmood', phone: '0345-7772233', email: 'tariq@nexgenhub.pk', address: 'Uni Center Karachi' }
  ];

  const insertSupplier = db.prepare(`
    INSERT OR IGNORE INTO suppliers (id, name, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  suppliers.forEach(s => insertSupplier.run(s.id, s.name, s.person, s.phone, s.email, s.address));

  // 4. Products with realistic computer accessories & barcodes
  // Note: has_serials = 1 for components where individual serial tracking & warranty matters
  const products = [
    {
      id: 1,
      barcode: '8806090558451',
      name: 'Samsung 980 Pro 1TB NVMe PCIe 4.0 SSD',
      category_id: 2,
      cost_price: 24000.0,
      sale_price: 28500.0,
      stock_quantity: 12,
      low_stock_threshold: 4,
      supplier_id: 1,
      has_serials: 1,
      warranty_months: 24,
      desc: 'High-speed PCIe Gen 4 SSD up to 7,000 MB/s'
    },
    {
      id: 2,
      barcode: '097855140883',
      name: 'Logitech G502 HERO High Performance Gaming Mouse',
      category_id: 1,
      cost_price: 9500.0,
      sale_price: 12500.0,
      stock_quantity: 18,
      low_stock_threshold: 5,
      supplier_id: 2,
      has_serials: 0,
      warranty_months: 12,
      desc: '25,600 DPI Hero sensor with RGB lighting'
    },
    {
      id: 3,
      barcode: '6950376704153',
      name: 'Redragon K552 KUMARA RGB Mechanical Keyboard (Blue Switches)',
      category_id: 1,
      cost_price: 6800.0,
      sale_price: 8900.0,
      stock_quantity: 9,
      low_stock_threshold: 4,
      supplier_id: 3,
      has_serials: 0,
      warranty_months: 12,
      desc: 'Tenkeyless compact mechanical keyboard'
    },
    {
      id: 4,
      barcode: '740617319767',
      name: 'Kingston FURY Beast 16GB (1x16GB) DDR4 3200MHz RAM',
      category_id: 4,
      cost_price: 8200.0,
      sale_price: 10500.0,
      stock_quantity: 15,
      low_stock_threshold: 5,
      supplier_id: 1,
      has_serials: 1,
      warranty_months: 12,
      desc: 'Plug N Play heat spreader DDR4 module'
    },
    {
      id: 5,
      barcode: '824142247471',
      name: 'MSI GeForce RTX 3060 Ventus 2X 12G OC GPU',
      category_id: 3,
      cost_price: 82000.0,
      sale_price: 94000.0,
      stock_quantity: 4,
      low_stock_threshold: 2,
      supplier_id: 2,
      has_serials: 1,
      warranty_months: 24,
      desc: '12GB GDDR6 Dual Torx Fan 3.0 Graphics Card'
    },
    {
      id: 6,
      barcode: '6957303810055',
      name: 'UGREEN 4K 60Hz HDMI 2.0 Cable 2 Meter (Braided)',
      category_id: 6,
      cost_price: 1200.0,
      sale_price: 1850.0,
      stock_quantity: 2, // Intentional low stock to trigger dashboard warning!
      low_stock_threshold: 5,
      supplier_id: 3,
      has_serials: 0,
      warranty_months: 6,
      desc: 'Braided 18Gbps HDR audio return channel cable'
    },
    {
      id: 7,
      barcode: '0761345116084',
      name: 'Antec CSK 650W 80 Plus Bronze Power Supply',
      category_id: 5,
      cost_price: 14500.0,
      sale_price: 17500.0,
      stock_quantity: 6,
      low_stock_threshold: 3,
      supplier_id: 1,
      has_serials: 1,
      warranty_months: 24,
      desc: 'Active PFC 120mm silent fan power supply unit'
    },
    {
      id: 8,
      barcode: '6953156214583',
      name: 'Baseus Aluminium USB 3.0 to Type-C OTG Converter',
      category_id: 6,
      cost_price: 450.0,
      sale_price: 850.0,
      stock_quantity: 25,
      low_stock_threshold: 8,
      supplier_id: 3,
      has_serials: 0,
      warranty_months: 3,
      desc: 'Zinc alloy mini OTG fast sync adapter'
    },
    {
      id: 9,
      barcode: '8806091244018',
      name: 'Crucial P3 Plus 500GB PCIe 4.0 NVMe SSD',
      category_id: 2,
      cost_price: 11000.0,
      sale_price: 13800.0,
      stock_quantity: 3, // Low stock alert!
      low_stock_threshold: 5,
      supplier_id: 1,
      has_serials: 1,
      warranty_months: 12,
      desc: 'Up to 4700 MB/s read speed M.2 NVMe SSD'
    }
  ];

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, barcode, name, category_id, cost_price, sale_price,
      stock_quantity, low_stock_threshold, supplier_id, has_serials, warranty_months, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  products.forEach(p => {
    insertProduct.run(
      p.id, p.barcode, p.name, p.category_id, p.cost_price, p.sale_price,
      p.stock_quantity, p.low_stock_threshold, p.supplier_id, p.has_serials, p.warranty_months, p.desc
    );
  });

  // 5. In-stock Component Serial Numbers (for Samsung 980 Pro and MSI RTX 3060)
  const serials = [
    { sn: 'SN-SAM-980P-00101', pid: 1, status: 'in_stock' },
    { sn: 'SN-SAM-980P-00102', pid: 1, status: 'in_stock' },
    { sn: 'SN-SAM-980P-00103', pid: 1, status: 'in_stock' },
    { sn: 'SN-MSI-3060-88001', pid: 5, status: 'in_stock' },
    { sn: 'SN-MSI-3060-88002', pid: 5, status: 'in_stock' },
    { sn: 'SN-KNG-16G-4401', pid: 4, status: 'in_stock' },
    { sn: 'SN-KNG-16G-4402', pid: 4, status: 'in_stock' },
    { sn: 'SN-ANT-650W-9101', pid: 7, status: 'in_stock' }
  ];

  const insertSerial = db.prepare(`
    INSERT OR IGNORE INTO serial_numbers (serial_number, product_id, status)
    VALUES (?, ?, ?)
  `);
  serials.forEach(s => insertSerial.run(s.sn, s.pid, s.status));

  // 6. Default Store Settings
  const settings = [
    { key: 'store_name', value: 'Unaib Computer Accessories' },
    { key: 'store_tagline', value: 'Gaming Rigs, High-End Components & Genuine Accessories' },
    { key: 'store_address', value: 'Shop #14, Ground Floor, Techno City Plaza, I.I. Chundrigar Rd, Karachi' },
    { key: 'store_phone', value: '+92 300 9258123 / 021-32278910' },
    { key: 'store_email', value: 'sales@unaibcomputers.com' },
    { key: 'currency_symbol', value: 'Rs.' },
    { key: 'tax_rate', value: '0' },
    { key: 'receipt_size', value: '80mm' }, // 58mm or 80mm
    { key: 'receipt_footer', value: 'Warranty Terms: 7 days check warranty for unsealed items. 1-2 year brand warranty for serialized components. Physical/burn damage voids warranty.' },
    { key: 'invoice_prefix', value: 'UCA' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO store_settings (key, value)
    VALUES (?, ?)
  `);
  settings.forEach(s => insertSetting.run(s.key, s.value));

  // 7. Seed sample walk-in customers
  const customers = [
    { id: 1, name: 'Kashif Riaz', phone: '0302-9988776', email: 'kashif@gmail.com', address: 'Gulshan-e-Iqbal, Karachi', spent: 45000 },
    { id: 2, name: 'Zeeshan Khan', phone: '0333-1122334', email: 'zeeshan.k@outlook.com', address: 'DHA Phase 5, Karachi', spent: 115000 }
  ];
  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (id, name, phone, email, address, total_spent)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  customers.forEach(c => insertCustomer.run(c.id, c.name, c.phone, c.email, c.address, c.spent));

  console.log('Database seeded successfully with Unaib Computer Accessories initial catalog!');
}

module.exports = { seed };
