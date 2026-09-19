import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  ur: {
    // Top Bar & Branding
    terminal_title: 'فروخت و بلنگ کاؤنٹر',
    store_sub: 'کمپیوٹر ایکسیسریز و ہارڈویئر',
    shift_open: 'گلہ: کھلا ہے',
    shift_closed: 'گلہ: بند ہے',
    low_stock_alert: 'کم اسٹاک الرٹ',
    logout_btn: 'لاگ آؤٹ / صارف تبدیل کریں',
    lang_btn: 'آسان اردو',
    switch_to_en: 'English',
    admin_role: 'مالک / ایڈمن',
    cashier_role: 'کیشیئر / ملازم',

    // Sidebar Items
    nav_dashboard: 'ڈیش بورڈ (خلاصہ)',
    nav_pos: 'نیا بل / کاؤنٹر سیل',
    nav_invoices: 'بلوں کی ہسٹری',
    nav_inventory: 'سامان کا اسٹاک',
    nav_suppliers: 'سپلائرز لسٹ',
    nav_purchases: 'مال خریداری (GRN)',
    nav_sale_return: 'سیل واپسی',
    nav_purchase_return: 'خریداری واپسی',
    nav_ledger: 'کھاتہ و پارٹیاں',
    nav_warranty: 'وارنٹی و سیریل نمبر',
    nav_drawer: 'دکان کا گلہ (کیش)',
    nav_expenses: 'دکان کے خرچے',
    nav_reports: 'منافع و مالی رپورٹس',
    nav_activity_logs: 'آڈٹ ٹریل (ایکٹیویٹی لاگ)',
    nav_settings: 'سسٹم سیٹنگز',

    // POS Screen - Front Counter
    scan_placeholder: 'بارکوڈ اسکین کریں یا کوڈ لکھیں...',
    search_placeholder: 'سامان تلاش کریں (جیسے RAM, SSD, Mouse)...',
    clear_cart: 'کارٹ خالی کریں',
    proceed_to_payment: 'بل بنائیں اور رقم وصول کریں',
    cart_empty_title: 'کارٹ ابھی خالی ہے',
    cart_empty_sub: 'سامان شامل کرنے کے لیے اوپر بارکوڈ اسکین کریں یا نام لکھیں',
    col_item: 'سامان کی تفصیل',
    col_warranty: 'وارنٹی',
    col_serial: 'سیریل نمبر',
    col_qty: 'تعداد',
    col_price: 'ریٹ (فروخت)',
    col_total: 'ٹوٹل رقم',
    subtotal: 'سامان کا ٹوٹل:',
    discount: 'رعایت / ڈسکاؤنٹ:',
    tax: 'سیلز ٹیکس:',
    shipping_expense: 'کرایہ / کوریئر / ٹرانسپورٹ خرچہ:',
    shipping_cost_label: 'کرایہ / کوریئر رقم (Rs):',
    shipping_notes_label: 'بلٹی یا رسید نمبر (اختیاری):',
    shipping_notes_ph: 'مثلاً: TCS #12345، المدینہ بلٹی #450، کارگو وغیرہ',
    extra_charges_label: 'طے شدہ ڈیل رقم:',
    extra_charges_added: 'طے شدہ ڈیل بل:',
    grand_total: 'کل بل رقم (Grand Total):',
    items_count: 'کل سامان کی تعداد:',
    stock_avail: 'موجود اسٹاک:',
    recovered_bill_title: 'پچھلا ادھورا بل بحال ہو گیا ہے',
    recovered_bill_sub: 'بجلی جانے یا کمپیوٹر بند ہونے سے پہلے اسکین کیا گیا سامان واپس لا دیا گیا ہے۔',
    btn_ok: 'ٹھیک ہے ✕',
    cash_deal: 'نقد فروخت',
    udhar_deal: 'ادھار کھاتہ بل',
    clear_cart_btn: 'نیا بل (کارٹ خالی)',

    // POS Screen - Payment & Billing Modal
    payment_modal_title: 'بل کی ادائیگی و رقم وصولی کاؤنٹر',
    tab_cash: 'نقد وصولی (Cash)',
    tab_udhar: 'ادھار کھاتہ (Party Khata)',
    tab_bank: 'کارڈ یا آن لائن بینک',
    payment_method_label: 'ادائیگی کا طریقہ منتخب کریں:',
    cash_tendered_label: 'وصول شدہ رقم (گاہک نے کتنے دیے):',
    exact_cash_btn: 'پورے پیسے',
    change_due_label: 'بقایا رقم گاہک کو واپس دیں:',
    short_amount_label: 'کم رقم:',
    full_settled_label: 'پورا حساب',
    cust_name_optional: 'گاہک کا نام (اختیاری):',
    cust_phone_optional: 'موبائل نمبر (اختیاری):',
    complete_cash_sale: 'نقد سیل مکمل کریں اور پرچی پرنٹ کریں',
    saving_sale: 'بل مکمل ہو رہا ہے...',
    wholesale_heading: 'ہول سیل پارٹی کھاتہ بل:',
    credit_sale_badge: 'ادھار بل',
    select_party_placeholder: 'پارٹی کا نام یا موبائل نمبر تلاش کریں...',
    party_khata_label: 'کھاتہ:',
    cash_paid_now: 'وصول ہوئی رقم (Cash Paid Now):',
    cash_paid_sub: 'پارٹی نے ابھی کاؤنٹر پر کتنے پیسے جمع کروائے',
    quick_select: 'فوری رقم:',
    poora_udhar: '0 (پورا ادھار)',
    half_50: '50% آدھا',
    full_bill: 'پورا بل',
    prev_khata_label: 'پچھلا کھاتہ بقایا:',
    curr_bill_label: 'اس بل کا نیا مال:',
    amount_received: 'وصول ہوئی رقم:',
    extra_deduction_label: 'اضافی رقم (پچھلے کھاتے سے کٹوتی):',
    bill_balance_label: 'اس بل کا ادھار:',
    net_new_khata: 'کل نیا کھاتہ بقایا:',
    save_udhar_invoice: 'ادھار بل محفوظ کریں اور کھاتے میں ڈالیں',
    saving_udhar: 'کھاتے میں درج ہو رہا ہے...',
    card_bank_details: 'کارڈ یا بینک ٹرانسفر کی تفصیل:',
    card_pos_machine: 'کارڈ / POS مشین',
    online_bank_upi: 'آن لائن / بینک',
    card_ref_placeholder: 'کارڈ کے آخری 4 ہندسے یا ٹرانزیکشن ID (اختیاری)...',
    cancel_btn: 'منسوخ کریں',
    offline_bill_saved: 'بل آف لائن محفوظ ہو گیا - انٹرنیٹ آنے پر خودکار سنک ہو جائے گا',
    select_party_err: 'براہ کرم رجسٹرڈ پارٹی منتخب کریں یا عام واک ان گاہک پر کلک کریں۔',

    // Purchases & GRN
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

    // GRN (Goods Received Note) Module
    grn_create_title: 'نئی مال وصولی رسید',
    grn_create_sub: 'سپلائر سے سامان وصول کر کے اسٹاک بڑھائیں اور کھاتے میں اندراج کریں',
    grn_view_list_btn: 'تمام رسیدیں دیکھیں',
    grn_supplier_label: 'سپلائر کا انتخاب کریں *',
    grn_select_supplier_option: '-- سپلائر منتخب کریں --',
    grn_payment_type_label: 'طریقہ ادائیگی *',
    grn_credit_type: 'ادھار کھاتہ',
    grn_cash_type: 'نقد ادائیگی',
    grn_date_label: 'تاریخ وصولی *',
    grn_notes_label: 'تفصیل و نوٹس',
    grn_notes_placeholder: 'مثلاً بل نمبر، ڈلیوری چالان حوالہ یا سامان کی تفصیل...',
    grn_items_breakdown: 'سامان و لاگت بریک ڈاؤن',
    grn_add_item_btn: '+ مزید سامان شامل کریں',
    grn_col_num: '#',
    grn_col_category: 'کیٹیگری',
    grn_select_category_option: '-- تمام کیٹیگریز --',
    grn_col_product: 'پراڈکٹ / سامان',
    grn_col_qty_rec: 'تعداد (وصول شدہ)',
    grn_col_cost: 'خریداری ریٹ / لاگت',
    grn_col_total: 'کل رقم',
    grn_col_action: 'حذف',
    grn_grand_total_label: 'کل رقم بل:',
    grn_on_credit: 'ادھار پر',
    grn_on_cash: 'نقد پر',
    grn_submit_btn: '✓ رسید محفوظ کریں',
    grn_saving_btn: 'محفوظ ہو رہا ہے...',
    grn_err_supplier: 'براہ کرم سپلائر کا انتخاب کریں۔',
    grn_err_date: 'وصولی کی تاریخ درج کرنا لازمی ہے۔',
    grn_err_meta: 'سپلائرز یا پراڈکٹس لوڈ کرنے میں ناکامی۔',
    grn_err_row_product: 'براہ کرم سامان / پراڈکٹ منتخب کریں۔',
    grn_err_row_qty: 'وصول شدہ تعداد صفر سے زیادہ ہونی چاہیے۔',
    grn_err_row_cost: 'خریداری لاگت منفی نہیں ہو سکتی۔',
    grn_row_prefix: 'قطار #',
    grn_success_created: 'مال وصولی رسید کامیابی سے بن گئی اور اسٹاک اپڈیٹ ہو گیا!',
    grn_select_product_option: '-- سامان / پراڈکٹ منتخب کریں --',
    grn_select_or_add_prod: '➕ + نیا پراڈکٹ رجسٹر کریں...',
    grn_quick_add_product: '+ نیا پراڈکٹ',
    grn_quick_add_supplier: '+ نیا سپلائر',
    grn_modal_new_prod_title: 'نیا پراڈکٹ شامل کریں',
    grn_modal_new_prod_sub: 'نیا سامان درج کریں تاکہ GRN میں فوری شامل ہو سکے',
    grn_modal_prod_name: 'سامان / پراڈکٹ کا نام *',
    grn_modal_prod_name_ph: 'مثلاً: Dell MS116 Optical Mouse یا Kingston 128GB SSD',
    grn_modal_category: 'کیٹیگری',
    grn_modal_cost_price: 'خریداری لاگت (Cost Price) *',
    grn_modal_sale_price: 'فروخت کی قیمت (Sale Price) *',
    grn_modal_barcode: 'بارکوڈ (اختیاری)',
    grn_modal_has_serials: 'کیا اس پراڈکٹ کے وارنٹی سیریل نمبرز ہیں؟',
    grn_modal_warranty_months: 'وارنٹی کے مہینے:',
    grn_modal_save_prod: 'پراڈکٹ محفوظ کریں',
    grn_current_stock: 'موجود اسٹاک:',
    grn_remove_row_title: 'قطار حذف کریں',
    grn_list_title: 'مال وصولی رسیدیں',
    grn_list_sub: 'سپلائرز سے موصول شدہ سامان کی تمام رسیدوں اور اسٹاک کا ریکارڈ',
    grn_new_btn: '+ نئی رسید بنائیں',
    grn_search_placeholder: 'GRN نمبر، سپلائر یا تاریخ سے تلاش...',
    grn_records_count: 'رسیدیں',
    grn_col_number: 'GRN نمبر',
    grn_col_supplier: 'سپلائر کا نام',
    grn_col_date: 'تاریخ وصولی',
    grn_col_items_count: 'سامان کی تعداد',
    grn_col_payment_type: 'طریقہ ادائیگی',
    grn_col_actions: 'ایکشن',
    grn_items_badge: 'آئٹمز',
    grn_loading: 'رسیدیں لوڈ ہو رہی ہیں...',
    grn_not_found: 'کوئی مال وصولی رسید نہیں ملی۔',
    grn_view_details_title: 'رسید کی تفصیلات',
    grn_detail_sub: 'وصول شدہ مال کا تفصیلی ریکارڈ',
    grn_detail_total: 'کل رقم بل:',
    grn_detail_qty_ordered: 'آرڈر تعداد',
    grn_detail_qty_received: 'وصول تعداد',
    grn_detail_unit_cost: 'لاگت ریٹ',
    grn_close_btn: 'بند کریں',
    grn_view_btn: 'تفصیل دیکھیں',
    grn_detail_load_err: 'تفصیلات لوڈ کرنے میں ناکامی۔',

    // Suppliers Module
    suppliers_page_title: 'سپلائر مینجمنٹ',
    suppliers_page_sub: 'ڈسٹری بیوٹرز اور وینڈرز کی مکمل معلومات اور حقیقی وقت کا بقایا ادھار',
    suppliers_add_btn: '+ نیا سپلائر شامل کریں',
    suppliers_search_placeholder: 'سپلائر کے نام، فون یا نمائندہ سے تلاش...',
    suppliers_count_badge: 'سپلائرز',
    suppliers_col_name: 'سپلائر کا نام',
    suppliers_col_contact: 'رابطہ کار',
    suppliers_col_phone: 'فون نمبر',
    suppliers_col_address: 'پتہ و لوکیشن',
    suppliers_col_due_balance: 'واجب الادا بقایا',
    suppliers_col_actions: 'ایکشنز',
    suppliers_loading: 'سپلائرز لوڈ ہو رہے ہیں...',
    suppliers_not_found: 'کوئی سپلائر نہیں ملا۔',
    suppliers_badge_due: '(واجب الادا)',
    suppliers_badge_advance: '(ایڈوانس)',
    suppliers_badge_settled: '(صاف)',
    suppliers_confirm_delete: 'کیا آپ واقعی اس سپلائر کو ڈیلیٹ کرنا چاہتے ہیں؟',
    suppliers_delete_success: 'سپلائر کامیابی سے ڈیلیٹ ہو گیا۔',
    suppliers_delete_err: 'سپلائر ڈیلیٹ نہیں ہو سکا (ہو سکتا ہے اس کا کوئی خریداری ریکارڈ موجود ہو)۔',
    suppliers_created_success: 'نیا سپلائر کامیابی سے شامل ہو گیا!',
    suppliers_updated_success: 'سپلائر کی معلومات اپڈیٹ ہو گئیں!',
    suppliers_load_err: 'سپلائرز لوڈ کرنے میں ناکامی۔',
    suppliers_btn_ledger: 'کھاتہ اسٹیٹمنٹ دیکھیں',
    suppliers_btn_edit: 'ایڈیٹ کریں',
    suppliers_btn_delete: 'ڈیلیٹ کریں',

    // Supplier Form Modal
    supplier_modal_title_new: '+ نیا سپلائر شامل کریں',
    supplier_modal_title_edit: 'سپلائر کی معلومات میں ترمیم',
    supplier_modal_sub: 'سپلائر و ڈسٹری بیوٹر ریکارڈ',
    supplier_field_name: 'سپلائر / کمپنی کا نام *',
    supplier_field_contact: 'رابطہ کار شخص',
    supplier_field_phone: 'فون نمبر',
    supplier_field_email: 'ای میل ایڈریس',
    supplier_field_address: 'پتہ / دکان و مارکیٹ',
    supplier_required: 'لازمی',
    supplier_ph_name: 'مثلاً TechZone Distribution',
    supplier_ph_contact: 'مثلاً محمد علی',
    supplier_ph_phone: 'مثلاً 0300-1234567',
    supplier_ph_email: 'vendor@example.com',
    supplier_ph_address: 'مثلاً شاپ #12، حفیظ سینٹر، لاہور',
    supplier_btn_cancel: 'منسوخ کریں',
    supplier_btn_save_new: '+ سپلائر شامل کریں',
    supplier_btn_save_edit: 'تبدیلیاں محفوظ کریں',
    supplier_saving: 'محفوظ ہو رہا ہے...',
    supplier_err_name_required: 'سپلائر کا نام درج کرنا لازمی ہے۔',
    supplier_err_save: 'سپلائر محفوظ کرنے میں خرابی پیش آگئی۔',

    // Stock Alerts Modal (OnlineStatusIndicator)
    stock_alert_modal_title: 'منفی اسٹاک الرٹس',
    stock_alert_modal_sub: 'آف لائن بلنگ کے دوران یہ اشیاء دستیاب اسٹاک سے زیادہ بکیں۔ براہ کرم دکان میں ان کا اسٹاک دستی طور پر ایڈجسٹ کریں۔',
    stock_alert_all_resolved: 'تمام اسٹاک الرٹس حل شدہ ہیں، کوئی منفی اسٹاک باقی نہیں۔',
    stock_alert_invoice_num: 'بل نمبر:',
    stock_alert_qty_sold: 'فروخت شدہ تعداد:',
    stock_alert_current_stock: 'موجودہ اسٹاک:',
    stock_alert_oversold_qty: 'منفی مقدار:',
    stock_alert_oversold_hint: 'عدد (اسٹاک سے اتنی زیادہ بک گئی)',
    stock_alert_resolving: 'حل ہو رہا ہے...',
    stock_alert_resolve_btn: '✓ اسٹاک ٹھیک ہو گیا',
    stock_alert_close_btn: 'بند کریں',

    // Khata / Ledgers Screen
    unified_ledger_title: 'مشترکہ کھاتہ لیجر',
    live_calculated_balance: 'لائیو حسابی بیلنس',
    ledger_sub: 'سپلائر خریداری اور گاہک ادھار کا مکمل کھاتہ بمعہ فوری ان پیج ادائیگی',
    tab_suppliers: 'سپلائرز کھاتہ (Suppliers)',
    tab_clients: 'گاہکوں کا کھاتہ (Customers)',
    all_suppliers: 'تمام سپلائرز',
    all_customers: 'تمام گاہک (پارٹیاں)',
    available_count: 'دستیاب',
    search_party_placeholder: 'نام یا فون نمبر تلاش کریں...',
    loading_parties: 'لوڈ ہو رہا ہے...',
    no_party_found: 'کوئی پارٹی نہیں ملی۔',
    no_phone: 'فون موجود نہیں',
    payable_cr: 'واجب الادا (Cr)',
    receivable_dr: 'ادھار (Dr)',
    advance: 'ایڈوانس',
    settled_clean: 'صاف',
    select_party_heading: 'پارٹی منتخب کریں',
    no_address: 'پتہ درج نہیں ہے',
    btn_record_payment: '+ رقم ادا کریں',
    btn_receive_payment: '+ رقم وصول کریں',
    kpi_purchases: 'کل مال خریداری (Debit)',
    kpi_sales: 'کل فروخت بل (Debit)',
    kpi_paid: 'کل ادا شدہ رقم (Credit)',
    kpi_received: 'کل وصول شدہ رقم (Credit)',
    kpi_net_due: 'خالص موجودہ بقایا',
    due_payable_cr: '(واجب الادا Cr)',
    due_receivable_dr: '(ادھار واجب الوصول Dr)',
    due_advance: '(ایڈوانس)',
    due_nil: '(صاف NIL)',
    statement_loading: 'کھاتہ اسٹیٹمنٹ لوڈ ہو رہی ہے...',
    statement_of: 'کھاتہ اسٹیٹمنٹ:',
    records_count: 'ریکارڈ',
    search_entries_placeholder: 'واؤچر نمبر، تفصیل یا بینک سے تلاش...',
    
    // Ledger Table Columns
    col_date: 'تاریخ',
    col_type: 'نوعیت',
    col_ref: 'ریفرنس نمبر',
    col_account: 'بینک / کیش کھاتہ',
    col_desc: 'تفصیل و نوٹس',
    col_debit: 'ڈیبٹ (مال اضافہ)',
    col_credit: 'کریڈٹ (رقم ادائیگی)',
    col_balance: 'رننگ بقایا',
    no_entries_title: 'کوئی کھاتہ ٹرانزیکشن موجود نہیں ہے۔',
    no_entries_hint: 'نئی ادائیگی درج کرنے کے لیے اوپر دیے گئے بٹن پر کلک کریں۔',
    payment_post_success: '✓ ادائیگی کامیابی سے کھاتے اور فنانشل اکاؤنٹ میں درج ہو گئی!',

    // Entry Types Labels
    type_opening_balance: 'ابتدائی بقایا',
    type_payment: 'ادائیگی / وصولی',
    type_payment_made: 'ادائیگی',
    type_payment_received: 'وصولی',
    type_grn: 'مال وصولی (GRN)',
    type_sale: 'سیل بل',
    type_sale_invoice: 'سیل بل',
    type_return: 'واپسی مال',
    type_sale_return: 'سیل واپسی',
    type_purchase_return: 'خریداری واپسی',

    // Payment Form Modal
    pay_modal_supplier: 'سپلائر کو ادائیگی درج کریں',
    pay_modal_client: 'گاہک سے وصولی درج کریں',
    current_due_label: 'موجودہ واجب الادا بقایا:',
    account_select_label: 'طریقہ / کھاتہ (Cash / Bank Account) *',
    required_field: 'لازمی فیلڈ',
    select_account_option: '-- کیش یا بینک اکاؤنٹ منتخب کریں --',
    pay_amount_label: 'ادائیگی کی رقم (Amount in Rs.) *',
    full_amount_quick: 'مکمل رقم',
    overpaying_notice_title: 'توجہ فرمائیں:',
    overpaying_notice_body: 'آپ واجب الادا رقم سے زیادہ ادا کر رہے ہیں، جو ایڈوانس میں درج ہو گی۔',
    pay_date_label: 'تاریخ ادائیگی *',
    notes_label: 'تفصیل و کیفیات (Notes / Remarks)',
    notes_placeholder: 'مثلاً چیک نمبر، آن لائن بینک ٹرانسفر ریفرنس...',
    btn_save_voucher: '✓ واؤچر محفوظ کریں',
    saving_voucher: 'محفوظ ہو رہا ہے...',
    err_select_account: 'براہ کرم کیش یا بینک اکاؤنٹ منتخب کریں۔',
    err_invalid_amount: 'ادائیگی کی رقم صفر سے زیادہ ہونی چاہیے۔',
    err_date_required: 'تاریخ درج کرنا لازمی ہے۔',

    // Manage Accounts (مالی اکاؤنٹس کا انتظام)
    nav_accounts: 'مالی اکاؤنٹس',
    accounts_title: 'مالی اکاؤنٹس کا انتظام',
    accounts_sub: 'دکان کے کیش کاؤنٹر، بینک اکاؤنٹس اور ڈیجیٹل والٹس کا انتظام و تفصیلات',
    accounts_add_btn: '+ نیا اکاؤنٹ شامل کریں',
    accounts_search_ph: 'اکاؤنٹ کا نام، نمبر یا برانچ سے تلاش کریں...',
    accounts_total_cards: 'کل اکاؤنٹس',
    accounts_cash_cards: 'کیش کاؤنٹرز',
    accounts_bank_cards: 'بینک اکاؤنٹس',
    accounts_wallet_cards: 'ڈیجیٹل والٹس',
    accounts_col_name: 'اکاؤنٹ کا نام',
    accounts_col_type: 'قسم (Type)',
    accounts_col_acc_no: 'اکاؤنٹ نمبر',
    accounts_col_branch: 'برانچ / ادارہ',
    accounts_col_balance: 'موجودہ بیلنس',
    accounts_col_default: 'بنیادی اکاؤنٹ',
    accounts_col_actions: 'ایکشنز',
    accounts_total_balance_card: 'کل کیش و بینک فنڈز',
    accounts_type_cash: 'کیش کاؤنٹر',
    accounts_type_bank: 'بینک اکاؤنٹ',
    accounts_type_wallet: 'ڈیجیٹل والٹ',
    accounts_default_badge: 'بنیادی اکاؤنٹ (ڈیفالٹ)',
    accounts_edit_btn: 'ترمیم کریں',
    accounts_delete_btn: 'ڈیلیٹ کریں',
    accounts_confirm_delete_title: 'اکاؤنٹ ڈیلیٹ کرنے کی تصدیق',
    accounts_confirm_delete_msg: 'کیا آپ واقعی اس اکاؤنٹ کو ڈیلیٹ کرنا چاہتے ہیں؟',
    accounts_delete_success: 'اکاؤنٹ کامیابی سے ڈیلیٹ کر دیا گیا ہے۔',
    accounts_created_success: 'نیا اکاؤنٹ کامیابی سے شامل کر لیا گیا ہے۔',
    accounts_updated_success: 'اکاؤنٹ کامیابی سے اپ ڈیٹ کر دیا گیا ہے۔',
    accounts_err_has_tx: 'یہ اکاؤنٹ ڈیلیٹ نہیں ہو سکتا، اس کی ٹرانزیکشن ہسٹری موجود ہے۔',
    accounts_default_cant_delete: 'بنیادی کیش کاؤنٹر ڈیلیٹ نہیں ہو سکتا۔',
    accounts_modal_add_title: 'نیا مالی اکاؤنٹ شامل کریں',
    accounts_modal_edit_title: 'اکاؤنٹ کی تفصیلات تبدیل کریں',
    accounts_modal_name_label: 'اکاؤنٹ کا نام *',
    accounts_modal_name_ph: 'جیسے: میزان بینک، ایزی پیسہ، یا کاؤنٹر 2',
    accounts_modal_type_label: 'اکاؤنٹ کی قسم *',
    accounts_modal_balance_label: 'ابتدائی / اوپننگ بیلنس (اختیاری)',
    accounts_modal_balance_ph: '0.00',
    accounts_modal_acc_no_label: 'اکاؤنٹ نمبر (اختیاری)',
    accounts_modal_acc_no_ph: 'جیسے: 0102-0103456789',
    accounts_modal_branch_label: 'برانچ یا بینک کا نام (اختیاری)',
    accounts_modal_branch_ph: 'جیسے: مین برانچ، صدر مارکیٹ',
    accounts_modal_default_label: 'اسے بنیادی (ڈیفالٹ) اکاؤنٹ بنائیں',
    accounts_no_accounts: 'کوئی اکاؤنٹ موجود نہیں ہے۔',
    accounts_no_accounts_sub: 'نیا اکاؤنٹ بنانے کے لیے اوپر دیئے گئے بٹن پر کلک کریں۔',
    accounts_saving: 'محفوظ ہو رہا ہے...',

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
    // Top Bar & Branding
    terminal_title: 'Sales & Billing Counter',
    store_sub: 'Computer Accessories & Hardware',
    shift_open: 'Drawer: Open',
    shift_closed: 'Drawer: Closed',
    low_stock_alert: 'Low Stock Alert',
    logout_btn: 'Logout / Switch User',
    lang_btn: 'English',
    switch_to_ur: 'آسان اردو',
    admin_role: 'Administrator',
    cashier_role: 'Cashier',

    // Sidebar Items
    nav_dashboard: 'Dashboard',
    nav_pos: 'Cash Billing (POS)',
    nav_invoices: 'Bills & Invoices',
    nav_inventory: 'Inventory & Stock',
    nav_suppliers: 'Suppliers List',
    nav_purchases: 'Stock Purchases (GRN)',
    nav_sale_return: 'Sale Return',
    nav_purchase_return: 'Purchase Return',
    nav_ledger: 'Party Ledgers (Khata)',
    nav_warranty: 'Warranty & Serials',
    nav_drawer: 'Cash Drawer',
    nav_expenses: 'Shop Expenses',
    nav_reports: 'Financial Reports',
    nav_activity_logs: 'Activity Audit Log',
    nav_settings: 'System Settings',

    // POS Screen - Front Counter
    scan_placeholder: 'Scan barcode or enter code...',
    search_placeholder: 'Search product name (e.g. RAM, SSD, Mouse)...',
    clear_cart: 'Clear Cart',
    proceed_to_payment: 'Proceed to Payment',
    cart_empty_title: 'Cart is empty',
    cart_empty_sub: 'Scan barcode or enter product name above to add items',
    col_item: 'Item Description',
    col_warranty: 'Warranty',
    col_serial: 'Serial Number',
    col_qty: 'Qty',
    col_price: 'Sale Price',
    col_total: 'Total',
    subtotal: 'Items Subtotal:',
    discount: 'Discount:',
    tax: 'Sales Tax:',
    shipping_expense: 'Shipping / Transport / Courier:',
    shipping_cost_label: 'Shipping / Courier (Rs):',
    shipping_notes_label: 'Bilty or Receipt # (Optional):',
    shipping_notes_ph: 'e.g. TCS #12345, Cargo Bilty #450',
    extra_charges_label: 'Deal Amount:',
    extra_charges_added: 'Deal Bill:',
    grand_total: 'Grand Total:',
    items_count: 'Total Items:',
    stock_avail: 'Stock:',
    recovered_bill_title: 'Previous draft bill recovered',
    recovered_bill_sub: 'Items scanned before system shutdown or power outage have been restored.',
    btn_ok: 'OK ✕',
    cash_deal: 'Cash Sale',
    udhar_deal: 'Credit / Khata Invoice',
    clear_cart_btn: 'New Bill (Clear Cart)',

    // POS Screen - Payment & Billing Modal
    payment_modal_title: 'Payment & Checkout Window',
    tab_cash: 'Cash Payment',
    tab_udhar: 'Party Credit (Khata)',
    tab_bank: 'Card / Online Bank',
    payment_method_label: 'Select Payment Method:',
    cash_tendered_label: 'Cash Tendered (Amount Received):',
    exact_cash_btn: 'Exact Cash',
    change_due_label: 'Change Return to Customer:',
    short_amount_label: 'Short Amount:',
    full_settled_label: 'Exact Payment',
    cust_name_optional: 'Customer Name (Optional):',
    cust_phone_optional: 'Mobile Number (Optional):',
    complete_cash_sale: 'Complete Cash Sale & Print Receipt',
    saving_sale: 'Processing sale...',
    wholesale_heading: 'Wholesale Party Credit Invoice:',
    credit_sale_badge: 'Credit Bill',
    select_party_placeholder: 'Search and select wholesale customer...',
    party_khata_label: 'Balance:',
    cash_paid_now: 'Cash Paid Now (Advance):',
    cash_paid_sub: 'Amount paid by party at counter for this invoice',
    quick_select: 'Quick Select:',
    poora_udhar: '0 (Full Credit)',
    half_50: '50% Half',
    full_bill: 'Full Bill',
    prev_khata_label: 'Previous Khata Balance:',
    curr_bill_label: 'Current Bill Total:',
    amount_received: 'Amount Received:',
    extra_deduction_label: 'Extra Payment (Deducted from Old Balance):',
    bill_balance_label: 'New Bill Balance:',
    net_new_khata: 'Net New Khata Balance:',
    save_udhar_invoice: 'Save Credit Invoice & Post to Ledger',
    saving_udhar: 'Saving to ledger...',
    card_bank_details: 'Card or Bank Transfer Details:',
    card_pos_machine: 'Card / POS Machine',
    online_bank_upi: 'Online / Bank Transfer',
    card_ref_placeholder: 'Transaction ID or Card Last 4 Digits (Optional)...',
    cancel_btn: 'Cancel',
    offline_bill_saved: 'Invoice saved offline. It will automatically sync when internet resumes.',
    select_party_err: 'Please select a registered party or choose Walk-in Retail Cash.',

    // Purchases & GRN
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

    // GRN (Goods Received Note) Module
    grn_create_title: 'Create Goods Received Note',
    grn_create_sub: 'Receive stock from supplier, update inventory and post to ledger',
    grn_view_list_btn: 'View GRN List',
    grn_supplier_label: 'Select Supplier *',
    grn_select_supplier_option: '-- Select Supplier --',
    grn_payment_type_label: 'Payment Type *',
    grn_credit_type: 'Credit Account',
    grn_cash_type: 'Cash Payment',
    grn_date_label: 'Received Date *',
    grn_notes_label: 'Remarks / Notes',
    grn_notes_placeholder: 'e.g. Invoice #, Delivery Challan or description...',
    grn_items_breakdown: 'Items & Cost Breakdown',
    grn_add_item_btn: '+ Add Item',
    grn_col_num: '#',
    grn_col_category: 'Category',
    grn_select_category_option: '-- All Categories --',
    grn_col_product: 'Product / Item',
    grn_col_qty_rec: 'Qty Received',
    grn_col_cost: 'Unit Cost',
    grn_col_total: 'Total',
    grn_col_action: 'Action',
    grn_grand_total_label: 'Grand Total:',
    grn_on_credit: 'On Credit',
    grn_on_cash: 'On Cash',
    grn_submit_btn: '✓ Submit GRN',
    grn_saving_btn: 'Saving GRN...',
    grn_err_supplier: 'Please select a supplier.',
    grn_err_date: 'Received date is required.',
    grn_err_meta: 'Failed to load suppliers or products.',
    grn_err_row_product: 'Please select a product.',
    grn_err_row_qty: 'Received quantity must be greater than zero.',
    grn_err_row_cost: 'Unit cost cannot be negative.',
    grn_row_prefix: 'Row #',
    grn_success_created: 'GRN created successfully and stock updated!',
    grn_select_product_option: '-- Select Product --',
    grn_select_or_add_prod: '➕ + Add New Product...',
    grn_quick_add_product: '+ Add Product',
    grn_quick_add_supplier: '+ Add Supplier',
    grn_modal_new_prod_title: 'Add New Product',
    grn_modal_new_prod_sub: 'Register a new item to instantly select in GRN',
    grn_modal_prod_name: 'Product / Item Name *',
    grn_modal_prod_name_ph: 'e.g. Dell MS116 Optical Mouse or Kingston 128GB SSD',
    grn_modal_category: 'Category',
    grn_modal_cost_price: 'Cost Price *',
    grn_modal_sale_price: 'Sale Price *',
    grn_modal_barcode: 'Barcode (Optional)',
    grn_modal_has_serials: 'Track warranty & serial numbers for this product?',
    grn_modal_warranty_months: 'Warranty (Months):',
    grn_modal_save_prod: 'Save Product',
    grn_current_stock: 'Current Stock:',
    grn_remove_row_title: 'Remove Row',
    grn_list_title: 'Goods Received Notes (GRN)',
    grn_list_sub: 'Record of all received vendor goods and inventory inward',
    grn_new_btn: '+ Create New GRN',
    grn_search_placeholder: 'Search by GRN #, supplier or date...',
    grn_records_count: 'records',
    grn_col_number: 'GRN Number',
    grn_col_supplier: 'Supplier Name',
    grn_col_date: 'Received Date',
    grn_col_items_count: 'Items Count',
    grn_col_payment_type: 'Payment Type',
    grn_col_actions: 'Actions',
    grn_items_badge: 'items',
    grn_loading: 'Loading GRNs...',
    grn_not_found: 'No GRN records found.',
    grn_view_details_title: 'GRN Details',
    grn_detail_sub: 'Detailed breakdown of received goods',
    grn_detail_total: 'Total Amount:',
    grn_detail_qty_ordered: 'Ordered Qty',
    grn_detail_qty_received: 'Received Qty',
    grn_detail_unit_cost: 'Unit Cost',
    grn_close_btn: 'Close',
    grn_view_btn: 'View',
    grn_detail_load_err: 'Failed to load details.',

    // Suppliers Module
    suppliers_page_title: 'Suppliers Management',
    suppliers_page_sub: 'Vendor profiles and real-time ledger balances',
    suppliers_add_btn: '+ Add New Supplier',
    suppliers_search_placeholder: 'Search by supplier name, phone or contact person...',
    suppliers_count_badge: 'Suppliers',
    suppliers_col_name: 'Supplier Name',
    suppliers_col_contact: 'Contact Person',
    suppliers_col_phone: 'Phone Number',
    suppliers_col_address: 'Address / Location',
    suppliers_col_due_balance: 'Current Balance',
    suppliers_col_actions: 'Actions',
    suppliers_loading: 'Loading suppliers...',
    suppliers_not_found: 'No suppliers found.',
    suppliers_badge_due: '(Payable)',
    suppliers_badge_advance: '(Advance)',
    suppliers_badge_settled: '(Clean)',
    suppliers_confirm_delete: 'Are you sure you want to delete supplier "{name}"?',
    suppliers_delete_success: 'Supplier deleted successfully.',
    suppliers_delete_err: 'Could not delete supplier (it may have purchase or ledger records).',
    suppliers_created_success: 'New supplier added successfully!',
    suppliers_updated_success: 'Supplier updated successfully!',
    suppliers_load_err: 'Failed to load suppliers.',
    suppliers_btn_ledger: 'View Ledger Statement',
    suppliers_btn_edit: 'Edit',
    suppliers_btn_delete: 'Delete',

    // Supplier Form Modal
    supplier_modal_title_new: '+ Add New Supplier',
    supplier_modal_title_edit: 'Edit Supplier Details',
    supplier_modal_sub: 'Vendor & Distributor Profile',
    supplier_field_name: 'Supplier / Company Name *',
    supplier_field_contact: 'Contact Person',
    supplier_field_phone: 'Phone Number',
    supplier_field_email: 'Email Address',
    supplier_field_address: 'Address / Location',
    supplier_required: 'Required',
    supplier_ph_name: 'e.g. TechZone Distribution',
    supplier_ph_contact: 'e.g. Muhammad Ali',
    supplier_ph_phone: 'e.g. 0300-1234567',
    supplier_ph_email: 'vendor@example.com',
    supplier_ph_address: 'e.g. Shop #12, Hafeez Centre, Lahore',
    supplier_btn_cancel: 'Cancel',
    supplier_btn_save_new: '+ Add Supplier',
    supplier_btn_save_edit: 'Save Changes',
    supplier_saving: 'Saving...',
    supplier_err_name_required: 'Supplier name is required.',
    supplier_err_save: 'Failed to save supplier.',

    // Stock Alerts Modal (OnlineStatusIndicator)
    stock_alert_modal_title: 'Oversold Stock Alerts',
    stock_alert_modal_sub: 'These items were sold beyond available stock while offline. Please manually reconcile shop inventory.',
    stock_alert_all_resolved: 'All stock alerts resolved, no negative stock remaining.',
    stock_alert_invoice_num: 'Invoice #:',
    stock_alert_qty_sold: 'Qty Sold:',
    stock_alert_current_stock: 'Current Stock:',
    stock_alert_oversold_qty: 'Oversold Qty:',
    stock_alert_oversold_hint: 'units (sold beyond stock)',
    stock_alert_resolving: 'Resolving...',
    stock_alert_resolve_btn: '✓ Resolve Stock',
    stock_alert_close_btn: 'Close',

    // Khata / Ledgers Screen
    unified_ledger_title: 'Unified Party Ledger',
    live_calculated_balance: 'Live Calculated Balance',
    ledger_sub: 'Complete record of supplier purchases and customer credit with in-page payment',
    tab_suppliers: 'Suppliers Ledger',
    tab_clients: 'Customers Ledger',
    all_suppliers: 'All Suppliers',
    all_customers: 'All Customers (Parties)',
    available_count: 'available',
    search_party_placeholder: 'Search by name or phone...',
    loading_parties: 'Loading...',
    no_party_found: 'No party found.',
    no_phone: 'No phone',
    payable_cr: 'Payable (Cr)',
    receivable_dr: 'Receivable (Dr)',
    advance: 'Advance',
    settled_clean: 'Settled',
    select_party_heading: 'Select a Party',
    no_address: 'No address on file',
    btn_record_payment: '+ Record Payment',
    btn_receive_payment: '+ Receive Payment',
    kpi_purchases: 'Total Purchases (Debit)',
    kpi_sales: 'Total Invoices (Debit)',
    kpi_paid: 'Total Paid (Credit)',
    kpi_received: 'Total Received (Credit)',
    kpi_net_due: 'Net Due Balance',
    due_payable_cr: '(Payable Cr)',
    due_receivable_dr: '(Receivable Dr)',
    due_advance: '(Advance)',
    due_nil: '(NIL)',
    statement_loading: 'Loading statement...',
    statement_of: 'Ledger Statement:',
    records_count: 'records',
    search_entries_placeholder: 'Search by voucher, notes or bank...',

    // Ledger Table Columns
    col_date: 'Date',
    col_type: 'Type',
    col_ref: 'Ref #',
    col_account: 'Bank / Cash Account',
    col_desc: 'Description & Notes',
    col_debit: 'Debit (Inward / Bill)',
    col_credit: 'Credit (Payment)',
    col_balance: 'Running Balance',
    no_entries_title: 'No ledger transactions recorded yet.',
    no_entries_hint: 'Click the button above to record a new payment or receipt.',
    payment_post_success: '✓ Payment successfully posted to ledger and financial account!',

    // Entry Types Labels
    type_opening_balance: 'Opening Balance',
    type_payment: 'Payment / Receipt',
    type_payment_made: 'Payment',
    type_payment_received: 'Receipt',
    type_grn: 'Goods Received (GRN)',
    type_sale: 'Sale Invoice',
    type_sale_invoice: 'Sale Invoice',
    type_return: 'Return',
    type_sale_return: 'Sale Return',
    type_purchase_return: 'Purchase Return',

    // Payment Form Modal
    pay_modal_supplier: 'Record Payment to Supplier',
    pay_modal_client: 'Receive Payment from Customer',
    current_due_label: 'Current Due Balance:',
    account_select_label: 'Account (Cash / Bank) *',
    required_field: 'Required',
    select_account_option: '-- Select Cash or Bank Account --',
    pay_amount_label: 'Payment Amount (Amount in Rs.) *',
    full_amount_quick: 'Full Balance',
    overpaying_notice_title: 'Please Note:',
    overpaying_notice_body: 'You are entering an amount greater than the due balance, which will be recorded as advance.',
    pay_date_label: 'Payment Date *',
    notes_label: 'Description & Notes (Optional)',
    notes_placeholder: 'e.g. Check number, online bank transfer ref...',
    btn_save_voucher: '✓ Post Payment Voucher',
    saving_voucher: 'Saving voucher...',
    err_select_account: 'Please select cash or bank account.',
    err_invalid_amount: 'Payment amount must be greater than zero.',
    err_date_required: 'Payment date is required.',

    // Manage Accounts
    nav_accounts: 'Manage Accounts',
    accounts_title: 'Financial Accounts Management',
    accounts_sub: 'Manage Cash Counters, Bank Accounts, and Digital Wallets',
    accounts_add_btn: '+ Add New Account',
    accounts_search_ph: 'Search by account name, number, or branch...',
    accounts_total_cards: 'Total Accounts',
    accounts_cash_cards: 'Cash Counters',
    accounts_bank_cards: 'Bank Accounts',
    accounts_wallet_cards: 'Digital Wallets',
    accounts_col_name: 'Account Name',
    accounts_col_type: 'Type',
    accounts_col_acc_no: 'Account Number',
    accounts_col_branch: 'Branch / Institution',
    accounts_col_balance: 'Current Balance',
    accounts_col_default: 'Default Account',
    accounts_col_actions: 'Actions',
    accounts_total_balance_card: 'Total Liquid Funds',
    accounts_type_cash: 'Cash Counter',
    accounts_type_bank: 'Bank Account',
    accounts_type_wallet: 'Digital Wallet',
    accounts_default_badge: 'Default Account',
    accounts_edit_btn: 'Edit',
    accounts_delete_btn: 'Delete',
    accounts_confirm_delete_title: 'Confirm Account Deletion',
    accounts_confirm_delete_msg: 'Are you sure you want to delete this account?',
    accounts_delete_success: 'Account deleted successfully.',
    accounts_created_success: 'Account added successfully.',
    accounts_updated_success: 'Account updated successfully.',
    accounts_err_has_tx: 'Cannot delete this account, it has existing transaction history.',
    accounts_default_cant_delete: 'Default Cash Counter cannot be deleted.',
    accounts_modal_add_title: 'Add New Financial Account',
    accounts_modal_edit_title: 'Edit Account Details',
    accounts_modal_name_label: 'Account Name *',
    accounts_modal_name_ph: 'e.g., Meezan Bank, Easypaisa, or Cash Counter 2',
    accounts_modal_type_label: 'Account Type *',
    accounts_modal_balance_label: 'Initial / Opening Balance (Optional)',
    accounts_modal_balance_ph: '0.00',
    accounts_modal_acc_no_label: 'Account Number (Optional)',
    accounts_modal_acc_no_ph: 'e.g., 0102-0103456789',
    accounts_modal_branch_label: 'Branch / Bank Name (Optional)',
    accounts_modal_branch_ph: 'e.g., Main Branch, Saddar',
    accounts_modal_default_label: 'Set as default account',
    accounts_no_accounts: 'No accounts found.',
    accounts_no_accounts_sub: 'Click the button above to add your first account.',
    accounts_saving: 'Saving...',

    // Common
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

/**
 * Universal Entry Type Badge Formatter
 * Complies strictly with the 5 required colors:
 * - GRN: Purple
 * - Payment: Green
 * - Opening Balance: Grey
 * - Sale: Blue
 * - Return: Amber
 */
export function getEntryTypeBadge(type, isUrdu = false) {
  const normType = String(type || '').toLowerCase().trim();

  switch (normType) {
    case 'grn':
      return {
        label: isUrdu ? 'مال وصولی (GRN)' : 'Goods Received (GRN)',
        bg: 'bg-purple-50 text-purple-700 border-purple-200'
      };

    case 'payment':
    case 'payment_made':
    case 'payment_received':
      return {
        label: isUrdu ? (normType === 'payment_received' ? 'رقم وصولی' : 'ادائیگی') : (normType === 'payment_received' ? 'Receipt' : 'Payment'),
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };

    case 'opening_balance':
      return {
        label: isUrdu ? 'ابتدائی بقایا' : 'Opening Balance',
        bg: 'bg-slate-100 text-slate-700 border-slate-300'
      };

    case 'sale':
    case 'sale_invoice':
      return {
        label: isUrdu ? 'سیل بل' : 'Sale Invoice',
        bg: 'bg-blue-50 text-blue-700 border-blue-200'
      };

    case 'return':
    case 'sale_return':
    case 'purchase_return':
      return {
        label: isUrdu
          ? (normType === 'sale_return' ? 'سیل واپسی' : normType === 'purchase_return' ? 'خریداری واپسی' : 'واپسی')
          : (normType === 'sale_return' ? 'Sale Return' : normType === 'purchase_return' ? 'Purchase Return' : 'Return'),
        bg: 'bg-amber-50 text-amber-800 border-amber-200'
      };

    default:
      // Clean readable fallback without underscores
      const cleaned = normType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return {
        label: cleaned || '-',
        bg: 'bg-slate-50 text-slate-700 border-slate-200'
      };
  }
}

/**
 * Helper to display account names cleanly without ugly bilingual parentheses
 * e.g. "کیش کاؤنٹر (Cash Counter)" -> "کیش کاؤنٹر" (UR) or "Cash Counter" (EN)
 */
export function formatAccountName(name, isUrdu = false) {
  if (!name) return '-';
  const str = String(name).trim();

  // Pattern: "اردو نام (English Name)"
  const match = str.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    const urduPart = match[1].trim();
    const enPart = match[2].trim();
    return isUrdu ? urduPart : enPart;
  }

  return str;
}

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
      isUrdu: lang === 'ur',
      getEntryTypeBadge: (type) => getEntryTypeBadge(type, lang === 'ur'),
      formatAccountName: (name) => formatAccountName(name, lang === 'ur')
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: 'ur',
      isUrdu: true,
      urduFont: 'farsi',
      setUrduFont: () => {},
      toggleUrduFont: () => {},
      toggleLanguage: () => {},
      t: (key, fallback) => translations['ur']?.[key] || fallback || key,
      getEntryTypeBadge: (type) => getEntryTypeBadge(type, true),
      formatAccountName: (name) => formatAccountName(name, true)
    };
  }
  return context;
}
