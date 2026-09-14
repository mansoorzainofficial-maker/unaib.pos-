const { getDb } = require('../config/db');

function populateDatabase() {
  const db = getDb();
  console.log('--- Populating 50 Products, 10 Suppliers, and 10 Customers with Ledgers ---');

  // Begin transaction
  db.exec('BEGIN TRANSACTION');

  try {
    // 1. Ensure 10 Categories
    const categories = [
      { id: 1, name: 'Keyboards & Mice', desc: 'Mechanical keyboards, gaming mice, mouse pads' },
      { id: 2, name: 'Storage & SSDs', desc: 'NVMe M.2 SSDs, SATA SSDs, External Hard Drives' },
      { id: 3, name: 'Graphics Cards', desc: 'NVIDIA GeForce & AMD Radeon GPUs' },
      { id: 4, name: 'RAM & Memory', desc: 'DDR4, DDR5 & DDR3 Desktop & Laptop RAM' },
      { id: 5, name: 'Power Supplies', desc: 'Bronze, Gold modular and non-modular PSUs' },
      { id: 6, name: 'Cables & Adapters', desc: 'HDMI, DisplayPort, Type-C, Ethernet cables' },
      { id: 7, name: 'Coolers & Fans', desc: 'ARGB Case fans, CPU Air & Liquid Coolers, Thermal Paste' },
      { id: 8, name: 'Audio & Headsets', desc: 'Gaming headsets, USB microphones, soundcards' },
      { id: 9, name: 'Motherboards & CPUs', desc: 'Intel & AMD Motherboards and Processors' },
      { id: 10, name: 'Casings & Hubs', desc: 'Gaming PC Cases, USB Hubs, Wi-Fi dongles' }
    ];

    const insCat = db.prepare(`
      INSERT INTO categories (id, name, description)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description
    `);
    categories.forEach(c => insCat.run(c.id, c.name, c.desc));

    // 2. 10 Realistic Wholesale Suppliers (Jin se maal aya)
    const suppliers = [
      { id: 1, name: 'Apex Tech Distributors', person: 'Hamza Malik', phone: '0321-5551234', email: 'sales@apextech.pk', address: 'Shop 44, Techno City Karachi', balance: 45000 },
      { id: 2, name: 'Hafeez Center Importers', person: 'Bilal Ahmed', phone: '0300-8889911', email: 'bilal@hafeezwholesalers.com', address: 'Plaza 3, Hafeez Center Lahore', balance: 85000 },
      { id: 3, name: 'Global Silicon Importers', person: 'Tariq Mehmood', phone: '0345-7772233', email: 'tariq@globalsilicon.pk', address: 'Uni Center I.I. Chundrigar Rd Karachi', balance: 120000 },
      { id: 4, name: 'Techno City Hardware Hub', person: 'Asim Rauf', phone: '0312-3334455', email: 'asim@technohub.pk', address: 'Mezzanine Floor, Techno City Karachi', balance: 35000 },
      { id: 5, name: 'Al-Lateef Electronics Wholesale', person: 'Haji Lateef', phone: '0301-4455667', email: 'lateef@allateef.pk', address: 'Hall Road Lahore', balance: 15000 },
      { id: 6, name: 'NexGen Component Traders', person: 'Farhan Shah', phone: '0333-5123456', email: 'farhan@nexgenpk.com', address: 'Blue Area Islamabad', balance: 60000 },
      { id: 7, name: 'Fast Track IT Distributors', person: 'Kamran Butt', phone: '0322-9876543', email: 'kamran@fasttrackit.pk', address: 'Saddar Rawalpindi', balance: 28000 },
      { id: 8, name: 'Super Micro Impex', person: 'Usman Ghani', phone: '0302-8765432', email: 'usman@supermicro.pk', address: 'Katchery Bazar Faisalabad', balance: 50000 },
      { id: 9, name: 'Pearl Continental Hardware', person: 'Rashid Khan', phone: '0346-6543210', email: 'rashid@pearlpc.pk', address: 'Deans Trade Center Peshawar', balance: 40000 },
      { id: 10, name: 'Uni Center Memory Store', person: 'Zubair Qureshi', phone: '0315-1239876', email: 'zubair@unicentermemory.pk', address: 'Uni Center Karachi', balance: 18000 }
    ];

    const insSup = db.prepare(`
      INSERT INTO suppliers (id, name, contact_person, phone, email, address, current_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        contact_person = excluded.contact_person,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        current_balance = excluded.current_balance
    `);

    suppliers.forEach(s => {
      insSup.run(s.id, s.name, s.person, s.phone, s.email, s.address, s.balance);

      // Add opening balance ledger entry if not exists
      const existingLedger = db.prepare(`SELECT id FROM ledger_entries WHERE party_type = 'supplier' AND party_id = ? AND entry_type = 'opening_balance'`).get(s.id);
      if (!existingLedger) {
        db.prepare(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_no, debit, credit, balance, description, entry_date
          ) VALUES ('supplier', ?, 'opening_balance', 'OPN-SUP-${s.id}', 0, ?, ?, 'Opening Balance (Pichli Adaigi / Payable)', DATE('now', '-7 days'))
        `).run(s.id, s.balance, s.balance);
      }
    });

    // 3. 10 Customers / Parties (Jin ko maal gaya / Udhar)
    const customers = [
      { id: 1, name: 'Tariq Computer Shop', phone: '0300-1122334', email: 'tariq@tariqshop.pk', address: 'Main Market Gulberg, Lahore', balance: 18500 },
      { id: 2, name: 'Bilal Gaming Zone & Net Cafe', phone: '0321-2233445', email: 'bilal@bilalgaming.pk', address: 'G1 Market Johar Town, Lahore', balance: 34000 },
      { id: 3, name: 'Usman Tech & CCTV Solutions', phone: '0333-3344556', email: 'usman@usmantech.com', address: 'Y Block DHA Phase 3, Lahore', balance: 12000 },
      { id: 4, name: 'Al-Rehman Computer Care', phone: '0345-4455667', email: 'rehman@alrehmancc.pk', address: 'Bank Square Market Model Town, Lahore', balance: 25500 },
      { id: 5, name: 'Hamza PC Builder', phone: '0301-5566778', email: 'hamza@hamzapc.pk', address: 'Regal Chowk Saddar, Karachi', balance: 42000 },
      { id: 6, name: 'Zeeshan Graphics Studio', phone: '0313-6677889', email: 'zeeshan@zgraphics.pk', address: 'Shadman Market, Lahore', balance: 15000 },
      { id: 7, name: 'Faisalabad Cyber Cafe', phone: '0302-7788990', email: 'cyber@faisalabadcafe.pk', address: 'Civil Lines, Faisalabad', balance: 22000 },
      { id: 8, name: 'Asif Repairing & Accessories', phone: '0322-8899001', email: 'asif@asifrepair.pk', address: 'Hall Road, Lahore', balance: 9500 },
      { id: 9, name: 'CyberX eSports Arena', phone: '0346-9900112', email: 'arena@cyberx.pk', address: 'Civic Center Bahria Town, Islamabad', balance: 65000 },
      { id: 10, name: 'Smart Solutions IT Lab', phone: '0315-1122998', email: 'lab@smartsolutions.pk', address: 'F-10 Markaz, Islamabad', balance: 30000 }
    ];

    const insCust = db.prepare(`
      INSERT INTO customers (id, name, phone, email, address, current_balance)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address,
        current_balance = excluded.current_balance
    `);

    customers.forEach(c => {
      insCust.run(c.id, c.name, c.phone, c.email, c.address, c.balance);

      const existingLedger = db.prepare(`SELECT id FROM ledger_entries WHERE party_type = 'customer' AND party_id = ? AND entry_type = 'opening_balance'`).get(c.id);
      if (!existingLedger) {
        db.prepare(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_no, debit, credit, balance, description, entry_date
          ) VALUES ('customer', ?, 'opening_balance', 'OPN-CUST-${c.id}', ?, 0, ?, 'Opening Balance (Pichla Udhar / Receivable)', DATE('now', '-7 days'))
        `).run(c.id, c.balance, c.balance);
      }
    });

    // 4. 50 Realistic Computer Accessories Products
    const products = [
      // RAM & Memory (Category 4)
      { id: 1, barcode: '740617319880', name: 'Kingston Fury Beast 16GB DDR4 3200MHz Desktop RAM', cat: 4, cost: 9500, sale: 11200, qty: 25, sup: 1, serial: 1, war: 12 },
      { id: 2, barcode: '740617319873', name: 'Kingston Fury Beast 8GB DDR4 3200MHz Desktop RAM', cat: 4, cost: 5200, sale: 6400, qty: 30, sup: 1, serial: 1, war: 12 },
      { id: 3, barcode: '843591070546', name: 'Corsair Vengeance LPX 16GB (2x8GB) DDR4 3200MHz', cat: 4, cost: 12000, sale: 14500, qty: 15, sup: 2, serial: 1, war: 24 },
      { id: 4, barcode: '843367130091', name: 'Lexar Ares 32GB (2x16GB) DDR5 6000MHz RGB Desktop RAM', cat: 4, cost: 32000, sale: 37500, qty: 10, sup: 3, serial: 1, war: 24 },
      { id: 5, barcode: '880608512301', name: 'Samsung 8GB DDR3 1600MHz Desktop RAM', cat: 4, cost: 1800, sale: 2500, qty: 40, sup: 10, serial: 1, war: 6 },
      { id: 6, barcode: '880608512302', name: 'SK Hynix 4GB DDR3 1333MHz Desktop RAM', cat: 4, cost: 900, sale: 1400, qty: 50, sup: 10, serial: 0, war: 6 },
      { id: 7, barcode: '649528903525', name: 'Crucial 8GB DDR4 3200MHz Laptop SODIMM RAM', cat: 4, cost: 5400, sale: 6800, qty: 20, sup: 1, serial: 1, war: 12 },
      { id: 8, barcode: '880608512303', name: 'Samsung 16GB DDR4 3200MHz Laptop SODIMM RAM', cat: 4, cost: 9800, sale: 12000, qty: 18, sup: 3, serial: 1, war: 12 },

      // Storage & SSDs (Category 2)
      { id: 9, barcode: '8806090558451', name: 'Samsung 980 Pro 1TB NVMe PCIe 4.0 M.2 SSD', cat: 2, cost: 24000, sale: 28500, qty: 15, sup: 1, serial: 1, war: 36 },
      { id: 10, barcode: '8806090558468', name: 'Samsung 970 EVO Plus 500GB NVMe M.2 SSD', cat: 2, cost: 12500, sale: 15200, qty: 20, sup: 1, serial: 1, war: 36 },
      { id: 11, barcode: '740617329919', name: 'Kingston NV2 1TB PCIe 4.0 NVMe SSD', cat: 2, cost: 16500, sale: 19800, qty: 25, sup: 2, serial: 1, war: 24 },
      { id: 12, barcode: '740617329902', name: 'Kingston NV2 500GB PCIe 4.0 NVMe SSD', cat: 2, cost: 9800, sale: 11800, qty: 30, sup: 2, serial: 1, war: 24 },
      { id: 13, barcode: '718037858487', name: 'WD Green 240GB 2.5" SATA III Internal SSD', cat: 2, cost: 4800, sale: 5900, qty: 35, sup: 4, serial: 1, war: 12 },
      { id: 14, barcode: '718037858494', name: 'WD Green 480GB 2.5" SATA III Internal SSD', cat: 2, cost: 8200, sale: 9900, qty: 25, sup: 4, serial: 1, war: 12 },
      { id: 15, barcode: '843367115876', name: 'Lexar NS100 256GB 2.5" SATA III SSD', cat: 2, cost: 4900, sale: 6000, qty: 20, sup: 3, serial: 1, war: 12 },
      { id: 16, barcode: '763649005423', name: 'Seagate Barracuda 1TB 3.5" 7200RPM Internal HDD', cat: 2, cost: 6500, sale: 8200, qty: 15, sup: 5, serial: 1, war: 12 },
      { id: 17, barcode: '763649005430', name: 'Seagate Barracuda 2TB 3.5" 7200RPM Internal HDD', cat: 2, cost: 11500, sale: 14000, qty: 12, sup: 5, serial: 1, war: 12 },
      { id: 18, barcode: '718037700106', name: 'Western Digital 500GB 3.5" Blue Desktop HDD', cat: 2, cost: 2800, sale: 3800, qty: 30, sup: 5, serial: 1, war: 6 },
      { id: 19, barcode: '760557818311', name: 'Transcend 1TB StoreJet 25M3 Anti-Shock External HDD', cat: 2, cost: 15000, sale: 18500, qty: 10, sup: 6, serial: 1, war: 12 },

      // Graphics Cards (Category 3)
      { id: 20, barcode: '4719072803155', name: 'MSI GeForce RTX 3060 Ventus 2X 12GB OC', cat: 3, cost: 82000, sale: 95000, qty: 6, sup: 1, serial: 1, war: 24 },
      { id: 21, barcode: '4895173619984', name: 'ZOTAC Gaming GeForce GTX 1660 Super 6GB GDDR6', cat: 3, cost: 52000, sale: 60000, qty: 8, sup: 2, serial: 1, war: 12 },
      { id: 22, barcode: '859345007123', name: 'AMD Radeon RX 580 8GB GDDR5 Gaming GPU', cat: 3, cost: 26000, sale: 31000, qty: 12, sup: 4, serial: 1, war: 6 },
      { id: 23, barcode: '4711387228807', name: 'ASUS Dual GeForce RTX 4060 8GB OC Edition', cat: 3, cost: 98000, sale: 115000, qty: 5, sup: 1, serial: 1, war: 36 },

      // Motherboards & Processors (Category 9)
      { id: 24, barcode: '4719331830410', name: 'GIGABYTE H610M H DDR4 Micro ATX Motherboard', cat: 9, cost: 24000, sale: 28000, qty: 10, sup: 2, serial: 1, war: 12 },
      { id: 25, barcode: '4719072972745', name: 'MSI PRO B550M-P GEN3 AMD AM4 Motherboard', cat: 9, cost: 28000, sale: 33000, qty: 8, sup: 1, serial: 1, war: 12 },
      { id: 26, barcode: '735858503045', name: 'Intel Core i5-12400F 6-Core Processor Box Pack', cat: 9, cost: 35000, sale: 40500, qty: 10, sup: 3, serial: 1, war: 12 },

      // Power Supplies (Category 5)
      { id: 27, barcode: '840006615026', name: 'Corsair CV550 550W 80 PLUS Bronze Power Supply', cat: 5, cost: 12500, sale: 15000, qty: 14, sup: 2, serial: 1, war: 24 },
      { id: 28, barcode: '841163062234', name: 'Thermaltake Smart 600W 80 PLUS Standard PSU', cat: 5, cost: 13000, sale: 15800, qty: 12, sup: 1, serial: 1, war: 24 },
      { id: 29, barcode: '844481010358', name: 'SilverStone Strider 500W 80 Plus Power Supply', cat: 5, cost: 9500, sale: 11800, qty: 15, sup: 7, serial: 1, war: 12 },

      // Keyboards & Mice (Category 1)
      { id: 30, barcode: '5099206089304', name: 'Logitech G102 Lightsync RGB Gaming Mouse', cat: 1, cost: 4800, sale: 5900, qty: 35, sup: 1, serial: 1, war: 12 },
      { id: 31, barcode: '5099206077844', name: 'Logitech G304 Lightspeed Wireless Gaming Mouse', cat: 1, cost: 9500, sale: 11800, qty: 20, sup: 1, serial: 1, war: 12 },
      { id: 32, barcode: '8886419332367', name: 'Razer DeathAdder Essential Gaming Mouse 6400 DPI', cat: 1, cost: 5800, sale: 7200, qty: 25, sup: 3, serial: 1, war: 12 },
      { id: 33, barcode: '4711421919875', name: 'A4Tech Bloody A90 Optical Gaming Mouse', cat: 1, cost: 4200, sale: 5200, qty: 30, sup: 4, serial: 1, war: 12 },
      { id: 34, barcode: '5099206045430', name: 'Logitech B100 USB Optical Wired Office Mouse', cat: 1, cost: 1100, sale: 1600, qty: 60, sup: 1, serial: 0, war: 6 },
      { id: 35, barcode: '6950376750586', name: 'Redragon K552 Kumara RGB Mechanical Gaming Keyboard', cat: 1, cost: 9500, sale: 11800, qty: 18, sup: 3, serial: 1, war: 12 },
      { id: 36, barcode: '4711421914214', name: 'Bloody B120 Turbo LED Illuminated Gaming Keyboard', cat: 1, cost: 4500, sale: 5800, qty: 22, sup: 4, serial: 0, war: 12 },
      { id: 37, barcode: '884116174821', name: 'Dell KB216 Wired Multimedia USB Office Keyboard', cat: 1, cost: 1600, sale: 2200, qty: 45, sup: 5, serial: 0, war: 6 },
      { id: 38, barcode: '6950376746930', name: 'Redragon P016 Taurus Large Waterproof Gaming Mouse Pad', cat: 1, cost: 2400, sale: 3200, qty: 25, sup: 3, serial: 0, war: 0 },

      // Audio & Headsets (Category 8)
      { id: 39, barcode: '8997034292154', name: 'Fantech Captain 7.1 HG11 RGB Surround Gaming Headset', cat: 8, cost: 5500, sale: 6900, qty: 20, sup: 6, serial: 1, war: 12 },
      { id: 40, barcode: '6950376778405', name: 'Redragon H510 Zeus 7.1 Surround Sound Gaming Headset', cat: 8, cost: 11000, sale: 13500, qty: 12, sup: 3, serial: 1, war: 12 },

      // Cables & Flash Drives (Category 6 & 10)
      { id: 41, barcode: '740617310016', name: 'Kingston DataTraveler Exodia 64GB USB 3.2 Flash Drive', cat: 6, cost: 1250, sale: 1750, qty: 50, sup: 1, serial: 0, war: 24 },
      { id: 42, barcode: '619659069193', name: 'SanDisk Cruzer Blade 32GB USB 2.0 Pen Drive', cat: 6, cost: 850, sale: 1250, qty: 60, sup: 5, serial: 0, war: 24 },
      { id: 43, barcode: '6935364050719', name: 'TP-Link TL-WN725N 150Mbps Wireless N Nano USB Adapter', cat: 10, cost: 1400, sale: 1950, qty: 35, sup: 7, serial: 0, war: 12 },
      { id: 44, barcode: '6935364006426', name: 'TP-Link Archer T3U Plus AC1300 High Gain Dual Band USB', cat: 10, cost: 4200, sale: 5200, qty: 18, sup: 7, serial: 0, war: 12 },
      { id: 45, barcode: '6957303810246', name: 'Ugreen HDMI 2.0 Cable 4K 60Hz 3 Meters Braided', cat: 6, cost: 1400, sale: 2000, qty: 40, sup: 8, serial: 0, war: 6 },
      { id: 46, barcode: '6953156220194', name: 'Baseus 4-in-1 USB 3.0 Type-C Multiport Hub', cat: 10, cost: 2800, sale: 3800, qty: 25, sup: 8, serial: 0, war: 6 },

      // Coolers, Fans & Cases (Category 7 & 10)
      { id: 47, barcode: '872767009585', name: 'Arctic MX-4 4g High Performance Thermal Compound Paste', cat: 7, cost: 1600, sale: 2200, qty: 50, sup: 9, serial: 0, war: 0 },
      { id: 48, barcode: '6933412727781', name: 'DeepCool AG400 ARGB Single-Tower CPU Air Cooler', cat: 7, cost: 6800, sale: 8500, qty: 15, sup: 9, serial: 1, war: 12 },
      { id: 49, barcode: '6974251810145', name: 'Ease EGG120 120mm ARGB Case Cooling Fan 3-in-1 Kit', cat: 7, cost: 4500, sale: 5900, qty: 20, sup: 9, serial: 0, war: 6 },
      { id: 50, barcode: '6972044810052', name: '1stPlayer X4-M Micro-ATX Mesh Gaming PC Case (4 Fans)', cat: 10, cost: 12000, sale: 14800, qty: 8, sup: 8, serial: 1, war: 6 }
    ];

    const insProd = db.prepare(`
      INSERT INTO products (
        id, barcode, name, category_id, cost_price, sale_price, stock_quantity,
        low_stock_threshold, supplier_id, has_serials, warranty_months, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        barcode = excluded.barcode,
        name = excluded.name,
        category_id = excluded.category_id,
        cost_price = excluded.cost_price,
        sale_price = excluded.sale_price,
        stock_quantity = excluded.stock_quantity,
        supplier_id = excluded.supplier_id,
        has_serials = excluded.has_serials,
        warranty_months = excluded.warranty_months
    `);

    products.forEach(p => {
      insProd.run(
        p.id,
        p.barcode,
        p.name,
        p.cat,
        p.cost,
        p.sale,
        p.qty,
        5, // low stock threshold
        p.sup,
        p.serial,
        p.war,
        `${p.name} - Genuine Computer Accessory`
      );
    });

    db.exec('COMMIT');
    console.log(`✅ Successfully loaded ${products.length} Products, ${suppliers.length} Suppliers, and ${customers.length} Customers with Ledgers!`);
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('❌ Population Error:', error);
    throw error;
  }
}

populateDatabase();
