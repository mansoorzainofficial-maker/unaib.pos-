import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  ur: {
    // Top Bar & Branding
    terminal_title: 'فروخت و بلنگ کاؤنٹر',
    store_sub: 'کمپیوٹر ایکسیسریز و ہارڈویئر',
    shift_open: 'دکان کا گلہ: کھلا ہے',
    shift_closed: 'دکان کا گلہ: بند ہے',
    low_stock_alert: 'کم اسٹاک الرٹ',
    logout_btn: 'لاگ آؤٹ / صارف تبدیل کریں',
    lang_btn: 'آسان اردو',
    switch_to_en: 'English',

    // Quick Modules Command Bar
    quick_modules: 'شارٹ کٹ ماڈیولز:',
    mod_pos: 'نیا بل / فروخت (F4)',
    mod_invoices: 'بلوں کا ریکارڈ',
    mod_inventory: 'سامان و اسٹاک',
    mod_purchases: 'مال کی خریداری (GRN)',
    mod_cust_ledger: 'گاہکوں کا کھاتہ',
    mod_supp_ledger: 'سپلائر کا کھاتہ',
    mod_reports: 'آمدن و منافع رپورٹ',
    mod_expenses: 'دکان کے خرچے',
    mod_warranty: 'وارنٹی و کلیم',
    mod_drawer: 'دکان کا گلہ',
    mod_settings: 'سیٹنگز',

    // Sidebar Items
    nav_pos: 'نیا بل / کاؤنٹر سیل',
    nav_invoices: 'بلوں کی ہسٹری',
    nav_inventory: 'سامان کا اسٹاک',
    nav_purchases: 'مال خریداری (GRN)',
    nav_ledger: 'کھاتہ و پارٹیاں',
    nav_warranty: 'وارنٹی و سیریل نمبر',
    nav_drawer: 'دکان کا گلہ (کیش)',
    nav_expenses: 'دکان کے خرچے',
    nav_reports: 'منافع و مالی رپورٹس',
    nav_settings: 'سسٹم سیٹنگز',

    // POS Screen - Front Counter
    scan_placeholder: 'بارکوڈ اسکین کریں (F2) یا کوڈ لکھ کر Enter دبائیں...',
    search_placeholder: 'سامان کا نام تلاش کریں (جیسے RAM, SSD, Mouse, Keyboard)...',
    clear_cart: 'کارٹ خالی کریں (F1)',
    proceed_to_payment: '⚡ بل بنائیں اور رقم وصول کریں (F4)',
    cart_empty_title: 'ابھی تک کوئی سامان شامل نہیں کیا گیا',
    cart_empty_sub: 'اوپر بارکوڈ اسکین کریں یا نام لکھ کر سامان شامل کریں',
    col_item: 'سامان کی تفصیل',
    col_warranty: 'وارنٹی',
    col_serial: 'سیریل نمبر',
    col_qty: 'تعداد',
    col_price: 'ریٹ (فروخت)',
    col_total: 'ٹوٹل رقم',
    subtotal: 'سامان کا ٹوٹل:',
    discount: 'رعایت / ڈسکاؤنٹ:',
    tax: 'سیلز ٹیکس:',
    grand_total: 'کل بل رقم (Grand Total):',
    items_count: 'کل آئٹمز',

    // Payment Modal (Alag Dedicated Window)
    payment_modal_title: 'بل کی ادائیگی و وصولی کاؤنٹر',
    tab_cash: '💵 نقد وصولی (Cash)',
    tab_udhar: '📋 ادھار کھاتہ (Party Khata)',
    tab_bank: '💳 کارڈ یا آن لائن بینک',

    // Cash Tab
    cash_tendered_label: 'وصول شدہ رقم (گاہک نے کتنے دیے):',
    exact_cash_btn: 'پورے پیسے (Exact)',
    change_due_label: 'بقایا رقم گاہک کو واپس دیں:',
    cust_name_optional: 'گاہک کا نام (اختیاری):',
    cust_phone_optional: 'موبائل نمبر (اختیاری - واٹس ایپ کے لیے):',
    complete_cash_sale: '⚡ نقد سیل مکمل کریں اور پرچی پرنٹ کریں',

    // Udhar / Party Tab
    select_party_label: 'ہول سیل پارٹی کا انتخاب کریں:',
    party_search_placeholder: 'پارٹی کا نام یا فون نمبر تلاش کریں...',
    cash_paid_now: 'وصول ہوئی رقم (Cash Paid Now):',
    cash_paid_sub: 'پارٹی نے ابھی کاؤنٹر پر کتنے پیسے جمع کروائے (20k, 30k وغیرہ)',
    prev_khata_label: 'پچھلا کھاتہ بقایا:',
    curr_bill_label: 'اس بل کا نیا مال:',
    amount_received: 'وصول ہوئی رقم:',
    extra_deduction_label: 'اضافی رقم (پچھلے کھاتے سے کٹوتی):',
    bill_balance_label: 'اس بل کا ادھار:',
    net_new_khata: 'کل نیا کھاتہ بقایا:',
    save_udhar_invoice: '📝 ادھار بل محفوظ کریں اور کھاتے میں ڈالیں',
    quick_select: 'فوری رقم:',
    poora_udhar: '0 (پورا ادھار)',

    // Purchases (Supplier Maal Khareed)
    purchases_title: 'سپلائرز سے مال کی خریداری و اسٹاک انٹری',
    new_purchase_btn: '+ نیا خریداری بل بنائیں',
    select_supplier: 'سپلائر منتخب کریں:',
    supplier_inv_no: 'سپلائر بل نمبر:',
    purchase_date: 'تاریخ خریداری:',
    add_product_row: 'سامان شامل کریں:',
    prod_name: 'سامان / پراڈکٹ:',
    cost_price: 'خریداری ریٹ (لاگت):',
    sale_price: 'فروخت ریٹ:',
    total_cost: 'کل لاگت:',
    paid_to_supplier: 'سپلائر کو ادا کی گئی رقم:',
    supplier_prev_bal: 'سپلائر پچھلا کھاتہ بقایا:',
    supplier_new_bal: 'کل نیا سپلائر کھاتہ بقایا:',
    save_purchase: '✓ خریداری بل محفوظ کریں',

    // Khata / Ledgers
    total_receivable: 'مارکیٹ سے کل رقم لینی ہے (Receivable):',
    total_payable: 'سپلائرز کو کل رقم دینی ہے (Payable):',
    cust_khata_tab: '👥 گاہکوں کا کھاتہ (Customers)',
    supp_khata_tab: '🚚 سپلائر کھاتہ (Suppliers)',
    add_new_party: '+ نئی پارٹی / گاہک شامل کریں',
    add_new_supplier: '+ نیا سپلائر شامل کریں',
    post_voucher_btn: '💰 رقم وصولی / ادائیگی درج کریں (Voucher)',
    voucher_amount: 'رقم (روپے) *:',
    voucher_method: 'ادائیگی کا طریقہ:',
    voucher_submit: '✓ کھاتے میں درج کریں',
    full_balance: 'پورا بقایا',

    // Common
    cancel: 'منسوخ کریں',
    save: 'محفوظ کریں',
    print: 'پرنٹ کریں',
    whatsapp: 'واٹس ایپ پرچی',
    search: 'تلاش کریں...',
    all: 'تمام',
    date: 'تاریخ',
    status: 'حالت',
    actions: 'ایکشنز',
    success: 'کامیابی',
    error: 'خرابی'
  },
  en: {
    terminal_title: 'POS Sales Terminal',
    store_sub: 'Computer Accessories & Hardware',
    shift_open: 'Cash Drawer: Shift Open',
    shift_closed: 'Cash Drawer: Closed',
    low_stock_alert: 'Low Stock Alert',
    logout_btn: 'Logout / Switch User',
    lang_btn: 'English',
    switch_to_ur: 'آسان اردو',

    quick_modules: 'Quick Modules:',
    mod_pos: 'Cash Billing (F4)',
    mod_invoices: 'Bills Record',
    mod_inventory: 'Stock & Items',
    mod_purchases: 'Purchases (GRN)',
    mod_cust_ledger: 'Customer Khata',
    mod_supp_ledger: 'Supplier Khata',
    mod_reports: 'Financial Reports',
    mod_expenses: 'Shop Expenses',
    mod_warranty: 'Warranty & Serials',
    mod_drawer: 'Cash Drawer',
    mod_settings: 'Settings',

    nav_pos: 'Cash Billing (POS)',
    nav_invoices: 'Bills & Invoices',
    nav_inventory: 'Inventory & Stock',
    nav_purchases: 'Stock Purchases (GRN)',
    nav_ledger: 'Party Ledgers (Khata)',
    nav_warranty: 'Warranty & Serials',
    nav_drawer: 'Cash Drawer',
    nav_expenses: 'Shop Expenses',
    nav_reports: 'Financial Reports',
    nav_settings: 'System Settings',

    scan_placeholder: 'Scan Barcode (F2) or type code & press Enter...',
    search_placeholder: 'Search product by name (e.g. RAM, SSD, Mouse)...',
    clear_cart: 'Clear Cart (F1)',
    proceed_to_payment: '⚡ Proceed to Payment (F4)',
    cart_empty_title: 'No items in cart',
    cart_empty_sub: 'Scan barcode or search product name above to add items',
    col_item: 'Item Description',
    col_warranty: 'Warranty',
    col_serial: 'Serial Number',
    col_qty: 'Qty',
    col_price: 'Sale Price',
    col_total: 'Total',
    subtotal: 'Items Subtotal:',
    discount: 'Discount:',
    tax: 'Sales Tax:',
    grand_total: 'Grand Total:',
    items_count: 'Total Items',

    payment_modal_title: 'Payment & Checkout Window',
    tab_cash: '💵 Cash (Naqad)',
    tab_udhar: '📋 Credit / Party Khata',
    tab_bank: '💳 Card / Online Bank',

    cash_tendered_label: 'Cash Tendered (Paid by Customer):',
    exact_cash_btn: 'Exact Cash',
    change_due_label: 'Change Return to Customer:',
    cust_name_optional: 'Customer Name (Optional):',
    cust_phone_optional: 'Mobile # (Optional - for WhatsApp):',
    complete_cash_sale: '⚡ Complete Cash Sale & Print Parchi',

    select_party_label: 'Select Wholesale Party:',
    party_search_placeholder: 'Search party by name or phone...',
    cash_paid_now: 'Cash Paid Now (Advance / Wasooli):',
    cash_paid_sub: 'Amount paid by party at counter (20k, 30k etc.)',
    prev_khata_label: 'Previous Khata Balance:',
    curr_bill_label: 'Current Bill Total:',
    amount_received: 'Amount Received:',
    extra_deduction_label: 'Extra Payment (Deducted from Old Khata):',
    bill_balance_label: 'New Bill Balance:',
    net_new_khata: 'Net New Khata Balance:',
    save_udhar_invoice: '📝 Save Udhar Invoice & Post to Khata',
    quick_select: 'Quick:',
    poora_udhar: '0 (Full Udhar)',

    purchases_title: 'Stock Purchases & Vendor Inward',
    new_purchase_btn: '+ New Purchase Bill',
    select_supplier: 'Select Supplier:',
    supplier_inv_no: 'Supplier Invoice #:',
    purchase_date: 'Purchase Date:',
    add_product_row: 'Add Product Item:',
    prod_name: 'Product:',
    cost_price: 'Cost Price:',
    sale_price: 'Sale Price:',
    total_cost: 'Total Cost:',
    paid_to_supplier: 'Paid to Supplier:',
    supplier_prev_bal: 'Supplier Previous Balance:',
    supplier_new_bal: 'Supplier New Balance:',
    save_purchase: '✓ Save Purchase Bill',

    total_receivable: 'Total Receivable (Market Khata):',
    total_payable: 'Total Payable (To Suppliers):',
    cust_khata_tab: '👥 Customers Khata',
    supp_khata_tab: '🚚 Suppliers Khata',
    add_new_party: '+ Add New Customer / Party',
    add_new_supplier: '+ Add New Supplier',
    post_voucher_btn: '💰 Post Payment Voucher',
    voucher_amount: 'Payment Amount (Rs.) *:',
    voucher_method: 'Payment Method:',
    voucher_submit: '✓ Post to Ledger',
    full_balance: 'Full Balance',

    cancel: 'Cancel',
    save: 'Save',
    print: 'Print Receipt',
    whatsapp: 'Send WhatsApp',
    search: 'Search...',
    all: 'All',
    date: 'Date',
    status: 'Status',
    actions: 'Actions',
    success: 'Success',
    error: 'Error'
  }
};

export function LanguageProvider({ children }) {
  // Default to Urdu ('ur') as requested by the user
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('unaib_pos_language') || 'ur';
    } catch (_) {
      return 'ur';
    }
  });

  // Default to 'farsi' font style (Vazirmatn - clean, legible, easy to understand) or 'nastaliq'
  const [urduFont, setUrduFontState] = useState(() => {
    try {
      return localStorage.getItem('unaib_pos_urdu_font') || 'farsi';
    } catch (_) {
      return 'farsi';
    }
  });

  useEffect(() => {
    if (lang === 'ur') {
      document.documentElement.setAttribute('lang', 'ur');
      document.body.classList.add('lang-ur');
      if (urduFont === 'nastaliq') {
        document.body.classList.add('font-style-nastaliq');
        document.body.classList.remove('font-style-farsi');
      } else {
        document.body.classList.add('font-style-farsi');
        document.body.classList.remove('font-style-nastaliq');
      }
    } else {
      document.documentElement.setAttribute('lang', 'en');
      document.body.classList.remove('lang-ur', 'font-style-nastaliq', 'font-style-farsi');
    }
  }, [lang, urduFont]);

  const toggleLanguage = () => {
    const next = lang === 'ur' ? 'en' : 'ur';
    setLang(next);
    try {
      localStorage.setItem('unaib_pos_language', next);
    } catch (_) {}
  };

  const setUrduFont = (font) => {
    setUrduFontState(font);
    try {
      localStorage.setItem('unaib_pos_urdu_font', font);
    } catch (_) {}
  };

  const toggleUrduFont = () => {
    const next = urduFont === 'farsi' ? 'nastaliq' : 'farsi';
    setUrduFont(next);
  };

  const t = (key, fallback = '') => {
    return translations[lang]?.[key] || translations['ur']?.[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{
      lang,
      setLang,
      toggleLanguage,
      urduFont,
      setUrduFont,
      toggleUrduFont,
      t,
      isUrdu: lang === 'ur'
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      lang: 'ur',
      isUrdu: true,
      urduFont: 'farsi',
      setUrduFont: () => {},
      toggleUrduFont: () => {},
      toggleLanguage: () => {},
      t: (key, fallback) => translations['ur']?.[key] || fallback || key
    };
  }
  return context;
}
