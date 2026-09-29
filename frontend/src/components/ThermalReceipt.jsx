import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  MessageSquare,
  Check,
  AlertTriangle,
  ShieldCheck,
  Share2,
  Copy,
  Phone,
  Languages
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ThermalReceipt({ invoice, onClose }) {
  const { isUrdu } = useLanguage();
  
  // Cache & Store settings fallback
  const localStore = (() => {
    try {
      return JSON.parse(localStorage.getItem('unaib_store_settings') || '{}');
    } catch (_) {
      return {};
    }
  })();

  const store = {
    store_name: 'UNAIB COMPUTERS',
    store_address: 'SHOP NO 20A GROUND FLOOR KARREM CLASSIC MARKET BESIDE TAYYAB COMPLEX CANTT HYDERABAD',
    store_phone: '0333-2644996',
    currency_symbol: 'Rs.',
    receipt_footer: 'Note: 7 days check warranty. Physical/burn damage voids warranty. Original slip required for claims.',
    ...localStore,
    ...(invoice?.store || {})
  };

  const configuredSize = store.receipt_size;
  const defaultSize = (configuredSize === '44mm' || configuredSize === '50mm' || configuredSize === '58mm' || configuredSize === '80mm' || configuredSize === 'a5' || configuredSize === 'a4')
    ? configuredSize
    : '44mm'; // Default to compact 44mm / 50mm POS parchi roll!

  const [receiptWidth, setReceiptWidth] = useState(defaultSize); // '44mm', '50mm', '58mm', '80mm', 'a4', 'a5'
  const [receiptLang, setReceiptLang] = useState(isUrdu ? 'ur' : 'en');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);
  const receiptTopRef = useRef(null);

  const isUrduReceipt = receiptLang === 'ur';

  useEffect(() => {
    if (receiptTopRef.current) {
      receiptTopRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [invoice]);

  if (!invoice) return null;

  const currency = store.currency_symbol || 'Rs.';

  // Format Date in Pakistan Standard Time (PKT UTC+5)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      let isoStr = dateStr;
      if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z')) {
        isoStr = dateStr.replace(' ', 'T') + 'Z';
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return dateStr;

      const datePart = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart}, ${timePart}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Clean and parse sequence number from invoice number (e.g. UCA-20260909-0005 -> 0005)
  const getDisplayInvoiceNo = () => {
    if (!invoice.invoice_number) return `INV-${invoice.id || '0001'}`;
    const parts = invoice.invoice_number.split('-');
    if (parts.length >= 3) {
      return parts[2]; // '0005'
    }
    return invoice.invoice_number;
  };

  const displayInvNo = getDisplayInvoiceNo();

  const getCustomerDisplayName = (name, isUrdu) => {
    if (!name) return isUrdu ? 'عام واک ان گاہک' : 'Walk-in Retail';
    const lower = String(name).trim().toLowerCase();
    if (
      lower === 'walk-in customer' ||
      lower === 'walk-in' ||
      lower === 'walk in' ||
      lower === 'walk-in retail' ||
      lower === 'عام واک ان گاہک'
    ) {
      return isUrdu ? 'عام واک ان گاہک' : 'Walk-in Retail';
    }
    if (lower.startsWith('walk-in udhar') || lower.startsWith('واک ان ادھار گاہک') || lower.startsWith('walk-in credit')) {
      return isUrdu ? 'واک ان ادھار گاہک' : 'Walk-in Credit';
    }
    if (lower === 'valued customer') {
      return isUrdu ? 'محترم گاہک' : 'Valued Customer';
    }
    return name;
  };

  // Item counts
  const totalItemsCount = invoice.items ? invoice.items.length : 0;
  const totalQtyCount = invoice.items ? invoice.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) : 0;

  // Print handler with dynamic height calculation & hardware protection
  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintError('');
    try {
      if (window.electronAPI?.printReceipt) {
        let pageSizeOption;
        if (receiptWidth === '44mm' || receiptWidth === '50mm' || receiptWidth === '58mm' || receiptWidth === '80mm') {
          // Dynamically compute exact content height in microns to eliminate blank continuous roll paper feed
          const printEl = document.getElementById('thermal-receipt-print-area');
          // 1px at 96 DPI = 25400 / 96 microns = 264.58 microns.
          // Add 6mm (6000 microns) cutter buffer so text is never cut off by paper cutter
          const measuredMicrons = printEl
            ? Math.ceil((printEl.offsetHeight + 10) * 264.583)
            : (receiptWidth === '44mm' ? 60000 : (receiptWidth === '50mm' || receiptWidth === '58mm') ? 70000 : 90000);
          const dynamicHeight = Math.max(35000, measuredMicrons);

          const widthMicrons = receiptWidth === '44mm'
            ? 44000
            : (receiptWidth === '50mm' || receiptWidth === '58mm')
            ? 48000
            : 80000;

          pageSizeOption = { width: widthMicrons, height: dynamicHeight };
        } else if (receiptWidth === 'a5') {
          pageSizeOption = 'A5';
        } else {
          pageSizeOption = 'A4';
        }
        const res = await window.electronAPI.printReceipt({
          silent: false,
          pageSize: pageSizeOption
        });

        if (res && res.success === false && !res.cancelled) {
          setPrintError(res.error || (isUrduReceipt ? 'پرنٹر کنکشن ناکام رہا، کیبل چیک کریں' : 'Printer connection failed, please check cable'));
        }
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print failed:', err);
      setPrintError(isUrduReceipt ? 'پرنٹر کنکشن ناکام رہا، کیبل چیک کریں' : 'Printer connection failed, please check cable');
    } finally {
      setIsPrinting(false);
    }
  };

  // Format Pakistan mobile number to international format (e.g. 0301-5566778 -> 923015566778)
  const formatPhoneForWhatsApp = (phoneStr) => {
    if (!phoneStr) return '';
    let digits = phoneStr.replace(/[^0-9]/g, '');
    if (digits.startsWith('03') && digits.length === 11) {
      return '92' + digits.slice(1);
    } else if (digits.startsWith('3') && digits.length === 10) {
      return '92' + digits;
    } else if (digits.startsWith('92') && digits.length === 12) {
      return digits;
    }
    return digits;
  };

  // Generate formatted WhatsApp Bill Message
  const generateWhatsAppMessage = () => {
    const dateFormatted = formatDate(invoice.created_at);

    if (isUrduReceipt) {
      let msg = `*${(store.store_name || 'UNAIB COMPUTER ACCESSORIES').toUpperCase()}*\n`;
      msg += `📍 پتہ: ${store.store_address || 'Shop #14, Techno City Plaza, Karachi'}\n`;
      msg += `📞 رابطہ: ${store.store_phone || '0300-9258123'}\n`;
      if (store.tax_ntn || store.tax_strn) {
        msg += `🏛️ ٹیکس رجسٹریشن: ${store.tax_ntn ? `NTN: ${store.tax_ntn} ` : ''}${store.tax_strn ? `STRN: ${store.tax_strn}` : ''}\n`;
      }
      msg += `===============================\n`;
      msg += `🧾 *فروخت بل / رسید نمبر: #${displayInvNo}*\n`;
      msg += `🔖 کمپیوٹر بل کوڈ: ${invoice.invoice_number}\n`;
      msg += `📅 تاریخ و وقت: ${dateFormatted}\n`;
      msg += `👤 محترم گاہک: *${getCustomerDisplayName(invoice.customer_name, true)}*\n`;
      if (invoice.customer_phone) msg += `📱 موبائل نمبر: ${invoice.customer_phone}\n`;
      msg += `💳 طریقہ ادائیگی: ${invoice.payment_method === 'cash' ? 'نقد کیش' : invoice.payment_method === 'credit' ? 'ادھار کھاتہ' : invoice.payment_method?.toUpperCase()}\n`;
      msg += `===============================\n`;
      msg += `*خریدی گئی اشیاء کی تفصیل:*\n`;

      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item, idx) => {
          msg += `\n*${idx + 1}. ${item.product_name}*\n`;
          msg += `   تعداد: ${item.quantity} × ${currency} ${Number(item.unit_price).toLocaleString()} = *${currency} ${Number(item.total_price).toLocaleString()}*\n`;
          if (item.warranty_months > 0) {
            msg += `   🛡️ وارنٹی: ${item.warranty_months} ماہ\n`;
          }
          if (item.serial_numbers && item.serial_numbers.length > 0) {
            const sList = item.serial_numbers
              .map(s => (typeof s === 'object' ? s.serial_number : s))
              .filter(Boolean)
              .join(', ');
            if (sList) msg += `   🔢 سیریل نمبرز: ${sList}\n`;
          }
        });
      }

      msg += `\n===============================\n`;
      msg += `کل آئٹمز: ${totalItemsCount}  (تعداد: ${totalQtyCount})\n`;
      const displaySubtotal = Number(invoice.subtotal || 0) + Number(invoice.extra_charges || 0);
      msg += `*سب ٹوٹل:* ${currency} ${displaySubtotal.toLocaleString()}\n`;

      if (invoice.discount_amount > 0) {
        msg += `رعایت / ڈسکاؤنٹ: -${currency} ${Number(invoice.discount_amount).toLocaleString()}\n`;
      }

      if (invoice.tax_amount > 0) {
        msg += `سیلز ٹیکس (${invoice.tax_rate}%): +${currency} ${Number(invoice.tax_amount).toLocaleString()}\n`;
      }

      if (Number(invoice.shipping_cost || 0) > 0) {
        msg += `🚚 کرایہ / کوریئر (Shipping): +${currency} ${Number(invoice.shipping_cost).toLocaleString()}${invoice.shipping_notes ? ` (${invoice.shipping_notes})` : ''}\n`;
      }

      msg += `*کل بل رقم (Grand Total):* *${currency} ${Number(invoice.grand_total || 0).toLocaleString()}*\n`;
      msg += `*وصول شدہ رقم:* ${currency} ${Number(invoice.paid_amount || 0).toLocaleString()}\n`;

      if (invoice.balance_due > 0) {
        msg += `\n⚠️ *بقایا واجب الادا ادھار: ${currency} ${Number(invoice.balance_due).toLocaleString()}*\n`;
      }

      if (invoice.change_amount > 0) {
        msg += `بقایا گاہک کو واپسی: ${currency} ${Number(invoice.change_amount).toLocaleString()}\n`;
      }

      // Customer Khata running position (controlled by show_previous_balance toggle)
      if (Number(invoice.show_previous_balance ?? 1) === 1 && invoice.customer_balance !== undefined && invoice.customer_balance !== null) {
        const prevBalance = invoice.previous_customer_balance !== undefined && invoice.previous_customer_balance !== null
          ? Number(invoice.previous_customer_balance)
          : Math.max(0, (Number(invoice.customer_balance) || 0) - (Number(invoice.balance_due) || 0));
        msg += `\n📊 *گاہک کھاتہ و لیجر پوزیشن:*\n`;
        msg += `• پچھلا کھاتہ بقایا: ${currency} ${prevBalance.toLocaleString()}\n`;
        msg += `• اس بل کا نیا مال: +${currency} ${Number(invoice.grand_total || 0).toLocaleString()}\n`;
        if (Number(invoice.paid_amount || 0) > 0) {
          msg += `• وصول ہوئی رقم: -${currency} ${Number(invoice.paid_amount || 0).toLocaleString()}\n`;
        }
        if (Number(invoice.paid_amount || 0) > Number(invoice.grand_total || 0)) {
          const extraDeducted = Number(invoice.paid_amount) - Number(invoice.grand_total);
          msg += `• پچھلے کھاتے سے کٹوتی: -${currency} ${extraDeducted.toLocaleString()}\n`;
        } else if (invoice.balance_due > 0) {
          msg += `• اس بل کا نیا ادھار: +${currency} ${Number(invoice.balance_due).toLocaleString()}\n`;
        }
        msg += `• *کل نیا کھاتہ بقایا: ${currency} ${Number(invoice.customer_balance).toLocaleString()}*\n`;
      }

      msg += `===============================\n`;
      msg += `وارنٹی شرائط: 7 دن چیک وارنٹی۔ برانڈڈ سامان کی کمپنی وارنٹی۔ جلنے یا ٹوٹنے پر وارنٹی لاگو نہیں۔\n`;
      msg += `تشریف لانے کا بہت شکریہ!\n`;

      return msg;
    }

    // English Fallback
    let msg = `*${(store.store_name || 'UNAIB COMPUTER ACCESSORIES').toUpperCase()}*\n`;
    msg += `📍 ${store.store_address || 'Shop #14, Techno City, Karachi'}\n`;
    msg += `📞 Tel: ${store.store_phone || '0300-9258123'}\n`;
    if (store.tax_ntn || store.tax_strn) {
      msg += `🏛️ Tax Reg: ${store.tax_ntn ? `NTN: ${store.tax_ntn} ` : ''}${store.tax_strn ? `STRN: ${store.tax_strn}` : ''}\n`;
    }
    msg += `===============================\n`;
    msg += `🧾 *INVOICE / BILL #: ${displayInvNo}*\n`;
    msg += `🔖 Ref Code: ${invoice.invoice_number}\n`;
    msg += `📅 Date: ${dateFormatted}\n`;
    msg += `👤 Customer: *${invoice.customer_name || 'Valued Customer'}*\n`;
    if (invoice.customer_phone) msg += `📱 Phone: ${invoice.customer_phone}\n`;
    msg += `💳 Mode: ${invoice.payment_method?.toUpperCase() || 'CASH'}\n`;
    msg += `===============================\n`;
    msg += `*ITEMS PURCHASED:*\n`;

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, idx) => {
        msg += `\n*${idx + 1}. ${item.product_name}*\n`;
        msg += `   Qty: ${item.quantity} × ${currency} ${Number(item.unit_price).toLocaleString()} = *${currency} ${Number(item.total_price).toLocaleString()}*\n`;
        if (item.warranty_months > 0) {
          msg += `   🛡️ Warranty: ${item.warranty_months} Months\n`;
        }
        if (item.serial_numbers && item.serial_numbers.length > 0) {
          const sList = item.serial_numbers
            .map(s => (typeof s === 'object' ? s.serial_number : s))
            .filter(Boolean)
            .join(', ');
          if (sList) msg += `   🔢 S/N: ${sList}\n`;
        }
      });
    }

    msg += `\n===============================\n`;
    msg += `Total Items: ${totalItemsCount}  (Qty: ${totalQtyCount})\n`;
    const displaySubtotalEn = Number(invoice.subtotal || 0) + Number(invoice.extra_charges || 0);
    msg += `*Subtotal:* ${currency} ${displaySubtotalEn.toLocaleString()}\n`;

    if (invoice.discount_amount > 0) {
      msg += `Discount: -${currency} ${Number(invoice.discount_amount).toLocaleString()}\n`;
    }

    if (invoice.tax_amount > 0) {
      msg += `Tax (${invoice.tax_rate}%): +${currency} ${Number(invoice.tax_amount).toLocaleString()}\n`;
    }

    if (Number(invoice.shipping_cost || 0) > 0) {
      msg += `🚚 Shipping / Courier: +${currency} ${Number(invoice.shipping_cost).toLocaleString()}${invoice.shipping_notes ? ` (${invoice.shipping_notes})` : ''}\n`;
    }

    msg += `*TOTAL AMOUNT:* *${currency} ${Number(invoice.grand_total || 0).toLocaleString()}*\n`;
    msg += `*Paid / Received:* ${currency} ${Number(invoice.paid_amount || 0).toLocaleString()}\n`;

    if (invoice.balance_due > 0) {
      msg += `\n⚠️ *UDHAR / BAQAYA DUE: ${currency} ${Number(invoice.balance_due).toLocaleString()}*\n`;
    }

    if (invoice.change_amount > 0) {
      msg += `Change Wapis: ${currency} ${Number(invoice.change_amount).toLocaleString()}\n`;
    }

    // Customer Khata running position (controlled by show_previous_balance toggle)
    if (Number(invoice.show_previous_balance ?? 1) === 1 && invoice.customer_balance !== undefined && invoice.customer_balance !== null) {
      const prevBalance = invoice.previous_customer_balance !== undefined && invoice.previous_customer_balance !== null
        ? Number(invoice.previous_customer_balance)
        : Math.max(0, (Number(invoice.customer_balance) || 0) - (Number(invoice.balance_due) || 0));
      msg += `\n📊 *KHATA / LEDGER STATEMENT:*\n`;
      msg += `• Pichla Udhar: ${currency} ${prevBalance.toLocaleString()}\n`;
      msg += `• Naya Maal (This Bill): +${currency} ${Number(invoice.grand_total || 0).toLocaleString()}\n`;
      if (Number(invoice.paid_amount || 0) > 0) {
        msg += `• Raqam Wasool (Paid): -${currency} ${Number(invoice.paid_amount || 0).toLocaleString()}\n`;
      }
      if (Number(invoice.paid_amount || 0) > Number(invoice.grand_total || 0)) {
        const extraDeducted = Number(invoice.paid_amount) - Number(invoice.grand_total);
        msg += `• Extra Payment (Khata Deduct): -${currency} ${extraDeducted.toLocaleString()}\n`;
      } else if (invoice.balance_due > 0) {
        msg += `• Is Bill Ka Udhar: +${currency} ${Number(invoice.balance_due).toLocaleString()}\n`;
      }
      msg += `• *Kul Khata Baqaya (Total Due): ${currency} ${Number(invoice.customer_balance).toLocaleString()}*\n`;
    }

    msg += `===============================\n`;
    msg += `Shukriya for shopping with *${store.store_name}*!\n`;
    msg += `Warranty terms: 7 days check warranty. Physical/burn damage voids warranty.\n`;

    return msg;
  };

  // WhatsApp Button Click Handler
  const handleSendWhatsApp = () => {
    let targetPhone = formatPhoneForWhatsApp(invoice.customer_phone);

    if (!targetPhone) {
      const userPhone = prompt(
        isUrduReceipt
          ? 'گاہک کا فون نمبر بل میں درج نہیں ہے۔\nبراہ کرم واٹس ایپ موبائل نمبر درج کریں (مثال: 03001234567):'
          : 'Customer phone is not in invoice.\nPlease enter WhatsApp mobile number (e.g. 03001234567):'
      );
      if (!userPhone) return;
      targetPhone = formatPhoneForWhatsApp(userPhone);
    }

    if (!targetPhone) {
      alert(isUrduReceipt ? 'درست موبائل نمبر درج کریں۔' : 'Please enter a valid mobile number.');
      return;
    }

    const message = generateWhatsAppMessage();
    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;

    if (window.electronAPI?.openUrl) {
      window.electronAPI.openUrl(waUrl);
    } else {
      window.open(waUrl, '_blank');
    }
  };

  // Copy WhatsApp Text to Clipboard
  const handleCopyWhatsAppText = () => {
    const message = generateWhatsAppMessage();
    navigator.clipboard.writeText(message);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  // Generate SVG Code-128 Barcode Bars (Compact 22px height for thermal parchi)
  const renderSvgBarcode = (text) => {
    if (!text) return null;
    const clean = text.toUpperCase();
    const bars = [];
    let curX = 10;

    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      const w1 = (code % 3) + 1.2;
      const w2 = ((code * 2) % 3) + 1.2;
      const gap = ((code * 3) % 3) + 1.5;

      bars.push(<rect key={`b1-${i}`} x={curX} y="0" width={w1} height="22" fill="#000" />);
      curX += w1 + gap;
      bars.push(<rect key={`b2-${i}`} x={curX} y="0" width={w2} height="22" fill="#000" />);
      curX += w2 + gap;
    }

    const svgWidth = receiptWidth === '44mm'
      ? 'max-w-[130px] h-5'
      : (receiptWidth === '50mm' || receiptWidth === '58mm')
      ? 'max-w-[155px] h-5.5'
      : 'max-w-[180px] h-6';

    return (
      <svg
        viewBox={`0 0 ${curX + 10} 24`}
        className={`mx-auto ${svgWidth}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {bars}
      </svg>
    );
  };

  return (
    <div className="flex flex-col items-center select-text">
      {/* Pinned / Sticky Control Bar (hidden in print) */}
      <div className="sticky -top-5 -mx-5 px-5 py-3 bg-white/98 backdrop-blur border-b border-slate-200 z-30 w-[calc(100%+2.5rem)] flex flex-wrap items-center justify-between gap-2 shadow-xs no-print">
        {/* Left Controls: Paper Width & Language Selector */}
        <div className="flex items-center gap-3">
          {/* Paper Width selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-semibold text-slate-600">{isUrduReceipt ? 'سائز:' : 'Size:'}</span>
            <div className="inline-flex rounded-lg bg-slate-100 border border-slate-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setReceiptWidth('44mm')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  receiptWidth === '44mm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isUrduReceipt ? 'الٹرا کومپیکٹ تھرمل پرچی (44mm رول)' : 'Ultra Compact 44mm Receipt'}
              >
                <span>🧾 44mm ({isUrduReceipt ? 'الٹرا' : '44mm'})</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptWidth('50mm')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  receiptWidth === '50mm' || receiptWidth === '58mm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isUrduReceipt ? 'چھوٹی تھرمل پرچی (50mm / 58mm رول)' : 'Mini Thermal Parchi (50mm / 58mm)'}
              >
                <span>🧾 50mm ({isUrduReceipt ? 'چھوٹی پرچی' : '50mm'})</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptWidth('80mm')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                  receiptWidth === '80mm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isUrduReceipt ? 'بڑی تھرمل پرچی (80mm)' : 'Wide Thermal Roll (80mm)'}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setReceiptWidth('a4')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                  receiptWidth === 'a4' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isUrduReceipt ? 'مکمل A4 سائز کمپیوٹرائزڈ بل (لیزر پرنٹر)' : 'Full A4 Standard Computerized Invoice'}
              >
                <span>📄 A4</span>
              </button>
              <button
                type="button"
                onClick={() => setReceiptWidth('a5')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                  receiptWidth === 'a5' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isUrduReceipt ? 'آدھا A4 / A5 سائز کمپیوٹر بل' : 'Half A4 / A5 Computerized Invoice'}
              >
                <span>📄 A5</span>
              </button>
            </div>
          </div>

          {/* Receipt Language Toggle */}
          <div className="flex items-center space-x-1">
            <div className="inline-flex rounded-lg bg-slate-100 border border-slate-200 p-0.5 text-xs">
              <button
                onClick={() => setReceiptLang('ur')}
                className={`px-2.5 py-0.5 rounded-md font-bold transition-colors ${
                  isUrduReceipt ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇵🇰 آسان اردو
              </button>
              <button
                onClick={() => setReceiptLang('en')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                  !isUrduReceipt ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons: WhatsApp & Print */}
        <div className="flex items-center space-x-2">
          {/* WhatsApp Direct Share Button */}
          <button
            onClick={handleSendWhatsApp}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md transition-all ${
              invoice.balance_due > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400 animate-pulse'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
            title={isUrduReceipt ? 'گاہک کے واٹس ایپ پر مکمل بل اور کھاتہ تفصیل بھیجیں' : "Send formatted bill & Khata details directly on Customer's WhatsApp"}
          >
            <MessageSquare className="w-4 h-4 text-emerald-100" />
            <span>
              {invoice.balance_due > 0
                ? (isUrduReceipt ? '📲 ادھار بل بھیجیں (واٹس ایپ)' : '📲 Send Udhar Bill (WhatsApp)')
                : (isUrduReceipt ? '📲 واٹس ایپ بل بھیجیں' : '📲 WhatsApp Bill')}
            </span>
          </button>

          {/* Copy Message Button */}
          <button
            onClick={handleCopyWhatsAppText}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs transition-colors"
            title={isUrduReceipt ? 'واٹس ایپ بل کا ٹیکسٹ کاپی کریں' : 'Copy WhatsApp bill text to clipboard'}
          >
            {copiedMsg ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md text-xs transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? (isUrduReceipt ? 'پرنٹ ہو رہا ہے...' : 'Printing...') : (isUrduReceipt ? '🖨️ بل پرنٹ کریں' : 'Print')}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
            >
              {isUrduReceipt ? 'بند کریں' : 'Close'}
            </button>
          )}
        </div>
      </div>

      {/* Printer Error Warning Banner */}
      {printError && (
        <div className="w-full max-w-md mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 no-print animate-fade-in">
          <div className="flex items-center justify-between text-rose-700 font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{isUrduReceipt ? 'پرنٹر کنکشن / ہارڈویئر مسئلہ' : 'Hardware / Printer Error'}</span>
            </span>
            <button
              type="button"
              onClick={() => setPrintError('')}
              className="text-slate-400 hover:text-slate-700 text-xs px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-rose-600 font-urdu">
            {printError}
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPrintError('');
                window.print();
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-semibold cursor-pointer transition-colors"
            >
              {isUrduReceipt ? 'ونڈوز پرنٹ ڈائیلاگ (Ctrl+P)' : 'System Print Dialog (Ctrl+P)'}
            </button>
          </div>
        </div>
      )}

      {/* Prominent Void / Cancelled Alert Banner */}
      {(invoice.status === 'void' || invoice.status === 'cancelled') && (
        <div className="w-full max-w-md mt-3 p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-center space-y-1 shadow-xs no-print">
          <div className="text-xs font-black text-rose-700 tracking-wider flex items-center justify-center gap-1.5 font-urdu">
            <AlertTriangle className="w-4 h-4" />
            <span>{isUrduReceipt ? '⚠️ یہ بل منسوخ / ختم کر دیا گیا ہے' : 'YEH BILL VOID / CANCEL HO CHUKA HAI'}</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          {invoice.void_reason && (
            <div className="text-[11px] text-rose-700 font-urdu">
              {isUrduReceipt ? 'منسوخی کی وجہ: ' : 'Wajah (Reason): '}
              <span className="font-semibold text-slate-900">{invoice.void_reason}</span>
            </div>
          )}
          {invoice.voided_at && (
            <div className="text-[10px] text-slate-500 font-mono">
              {isUrduReceipt ? 'منسوخی کی تاریخ: ' : 'Voided On: '}{formatDate(invoice.voided_at)}
            </div>
          )}
        </div>
      )}

      {/* Top Anchor to ensure scroll starts at top */}
      <div ref={receiptTopRef} />

      {/* Printable Receipt Paper Container */}
      <div
        id="thermal-receipt-print-area"
        className={`bg-white text-black transition-all select-text border border-gray-300 relative ${
          receiptWidth === 'a4' || receiptWidth === 'a5'
            ? 'p-4 mt-3 rounded shadow-2xl'
            : receiptWidth === '44mm'
            ? 'p-1.5 mt-2 rounded shadow-xl'
            : 'p-2 mt-2 rounded shadow-xl'
        } ${
          isUrduReceipt ? 'receipt-urdu font-urdu text-right' : 'font-mono-receipt text-left'
        } ${
          receiptWidth === 'a4'
            ? 'w-full max-w-[760px] text-xs leading-normal receipt-a4 font-sans'
            : receiptWidth === 'a5'
            ? 'w-full max-w-[620px] text-xs leading-normal receipt-a5 font-sans'
            : receiptWidth === '44mm'
            ? 'w-[190px] text-[7.5px] leading-tight receipt-44mm'
            : receiptWidth === '50mm'
            ? 'w-[215px] text-[8px] leading-tight receipt-50mm'
            : receiptWidth === '58mm'
            ? 'w-[235px] text-[8.5px] leading-tight receipt-58mm'
            : 'w-[320px] text-[10px] leading-tight receipt-80mm'
        }`}
      >
        {receiptWidth === 'a4' || receiptWidth === 'a5' ? (
          /* =========================================================================
             A4 / A5 COMPUTERIZED INVOICE LAYOUT (Laser & DeskJet Printer)
             ========================================================================= */
          <div className="space-y-2 text-black">
            {/* Printable Watermark for Voided Invoices */}
            {(invoice.status === 'void' || invoice.status === 'cancelled') && (
              <div className="border-2 border-black text-black font-black text-center text-xs py-1 mb-1.5 bg-gray-200 uppercase tracking-widest font-urdu">
                {isUrduReceipt ? '*** منسوخ شدہ بل (VOIDED BILL) ***' : '*** VOIDED / CANCELLED ***'}
              </div>
            )}

            {/* Header: Store Identity & Contact */}
            <div className="border-b-2 border-black pb-1.5 text-center">
              <h1 className={`${receiptWidth === 'a4' ? 'text-lg md:text-xl' : 'text-base md:text-lg'} font-black tracking-tight uppercase text-black leading-tight`}>
                {store.store_name}
              </h1>
              <p className={`${receiptWidth === 'a4' ? 'text-xs' : 'text-[10px]'} font-bold text-gray-800`}>{store.store_tagline}</p>
              <p className={`${receiptWidth === 'a4' ? 'text-[10px]' : 'text-[9px]'} text-gray-700 leading-snug`}>{store.store_address}</p>
              <div className="flex items-center justify-center gap-4 text-[9.5px] font-semibold text-gray-900 mt-0.5">
                <span>{isUrduReceipt ? 'رابطہ:' : 'Tel:'} {store.store_phone}</span>
                {store.store_email && <span>{isUrduReceipt ? 'ای میل:' : 'Email:'} {store.store_email}</span>}
              </div>
              {(store.tax_ntn || store.tax_strn) && (
                <div className="text-[9px] font-bold text-gray-800 mt-0.5 flex justify-center gap-x-4">
                  {store.tax_ntn && <span>{isUrduReceipt ? 'این ٹی این:' : 'NTN:'} {store.tax_ntn}</span>}
                  {store.tax_strn && <span>{isUrduReceipt ? 'سیلز ٹیکس نمبر:' : 'STRN:'} {store.tax_strn}</span>}
                </div>
              )}
            </div>

            {/* Memo Title & Status Ribbon */}
            <div className="flex justify-between items-center bg-gray-100 border border-black px-2.5 py-1 rounded-xs text-[10.5px] font-bold">
              <div className="tracking-wide uppercase text-black font-black">
                {invoice.balance_due > 0
                  ? (isUrduReceipt
                      ? `★ ادھار سیلز میمو (${receiptWidth === 'a4' ? 'A4' : 'A5'} Credit Invoice) ★`
                      : `★ CREDIT / UDHAR SALE MEMO (${receiptWidth === 'a4' ? 'A4' : 'A5'}) ★`)
                  : (isUrduReceipt
                      ? `★ کمپیوٹر سیلز بل (${receiptWidth === 'a4' ? 'A4' : 'A5'} Cash Bill) ★`
                      : `★ COMPUTERIZED SALES INVOICE (${receiptWidth === 'a4' ? 'A4' : 'A5'}) ★`)}
              </div>
              <div className="font-mono text-[10.5px] font-bold text-black">
                {isUrduReceipt ? `بل نمبر: #${displayInvNo}` : `INVOICE: #${displayInvNo}`}
              </div>
            </div>

            {/* 2-Column Info Grid: Invoice Meta vs Customer Party */}
            <div className="grid grid-cols-2 gap-2 text-[9.5px] border border-gray-400 rounded-xs p-1.5 bg-gray-50/50">
              {/* Column 1: Bill Details */}
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'بل کوڈ:' : 'Ref Code:'}</span>
                  <span className="font-mono font-bold text-black">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'تاریخ و وقت:' : 'Date & Time:'}</span>
                  <span className="font-mono font-semibold text-black">{formatDate(invoice.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'کاؤنٹر کیشئر:' : 'Cashier:'}</span>
                  <span className="font-semibold text-black">{invoice.cashier_name || (isUrduReceipt ? 'ایڈمن' : 'Admin')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'طریقہ ادائیگی:' : 'Payment Mode:'}</span>
                  <span className="font-bold text-black">
                    {invoice.payment_method === 'cash'
                      ? (isUrduReceipt ? 'نقد کیش' : 'CASH')
                      : invoice.payment_method === 'credit'
                      ? (isUrduReceipt ? 'ادھار کھاتہ' : 'CREDIT')
                      : invoice.payment_method?.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Column 2: Customer Party Details */}
              <div className="space-y-0.5 border-l border-gray-300 pl-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'محترم گاہک:' : 'Customer:'}</span>
                  <span className="font-bold text-black">{getCustomerDisplayName(invoice.customer_name, isUrduReceipt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'موبائل نمبر:' : 'Phone:'}</span>
                  <span className="font-mono font-semibold text-black">{invoice.customer_phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">{isUrduReceipt ? 'پتہ / مارکیٹ:' : 'Address:'}</span>
                  <span className="text-black truncate max-w-[140px]">{invoice.customer_address || '—'}</span>
                </div>
              </div>
            </div>

            {/* Itemized Table (Full Width A5 Grid) */}
            <table className="w-full border-collapse border border-black text-[9.5px]">
              <thead>
                <tr className="bg-gray-100 border-b border-black font-bold text-black">
                  <th className="border-r border-black py-1 px-1 text-center w-6">#</th>
                  <th className={`border-r border-black py-1 px-2 ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                    {isUrduReceipt ? 'سامان و تفصیل (Item Description)' : 'Item Description & Details'}
                  </th>
                  <th className="border-r border-black py-1 px-1 text-center w-14">{isUrduReceipt ? 'وارنٹی' : 'Warranty'}</th>
                  <th className="border-r border-black py-1 px-1 text-center w-8">{isUrduReceipt ? 'تعداد' : 'Qty'}</th>
                  <th className="border-r border-black py-1 px-1.5 text-right w-18">{isUrduReceipt ? 'ریٹ' : 'Rate'}</th>
                  <th className="py-1 px-1.5 text-right w-20">{isUrduReceipt ? 'کل رقم' : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-300 align-top">
                    <td className="border-r border-gray-300 py-1 px-1 text-center font-mono text-[9px]">{idx + 1}</td>
                    <td className={`border-r border-gray-300 py-1 px-2 font-semibold text-black ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                      <div>{item.product_name}</div>
                      {item.serial_numbers && item.serial_numbers.length > 0 && (
                        <div className="text-[8px] font-mono text-gray-700 mt-0.5">
                          <span className="font-bold">{isUrduReceipt ? 'سیریل نمبر: ' : 'S/N: '}</span>
                          {item.serial_numbers.map((sn, sidx) => {
                            const serialText = typeof sn === 'object' ? sn.serial_number : sn;
                            return (
                              <span key={sidx} className="inline-block mr-1 font-semibold">
                                {serialText}{sidx < item.serial_numbers.length - 1 ? '، ' : ''}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="border-r border-gray-300 py-1 px-1 text-center font-mono text-[8.5px]">
                      {item.warranty_months > 0 ? `${item.warranty_months} M` : '—'}
                    </td>
                    <td className="border-r border-gray-300 py-1 px-1 text-center font-mono font-bold text-black">{item.quantity}</td>
                    <td className="border-r border-gray-300 py-1 px-1.5 text-right font-mono font-medium">{item.unit_price?.toLocaleString()}</td>
                    <td className="py-1 px-1.5 text-right font-mono font-bold text-black">{item.total_price?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Breakdown & Khata Summary (2 Columns) */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {/* Left Column: Khata Position & Terms */}
              <div className="space-y-1.5">
                {Number(invoice.show_previous_balance ?? 1) === 1 && invoice.customer_balance !== undefined && invoice.customer_balance !== null && (
                  <div className="border border-black rounded-xs p-1.5 bg-gray-50 text-[9px] space-y-0.5">
                    <div className="font-bold text-center border-b border-gray-300 pb-0.5 uppercase tracking-wider text-[8.5px]">
                      {isUrduReceipt ? 'گاہک کھاتہ خلاصہ (Khata Position)' : 'Customer Khata Position'}
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>{isUrduReceipt ? 'پچھلا ادھار:' : 'Previous Due:'}</span>
                      <span className="font-mono font-semibold">
                        {currency} {Number(invoice.previous_customer_balance !== undefined && invoice.previous_customer_balance !== null
                          ? invoice.previous_customer_balance
                          : Math.max(0, (Number(invoice.customer_balance) || 0) - (Number(invoice.balance_due) || 0))
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>{isUrduReceipt ? 'اس بل کا مال:' : 'This Bill:'}</span>
                      <span className="font-mono font-semibold">+ {currency} {Number(invoice.grand_total || 0).toLocaleString()}</span>
                    </div>
                    {Number(invoice.paid_amount || 0) > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>{isUrduReceipt ? 'ادا شدہ رقم:' : 'Paid:'}</span>
                        <span className="font-mono font-semibold text-emerald-800">- {currency} {Number(invoice.paid_amount || 0).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-black pt-0.5 border-t border-gray-300 text-[10px]">
                      <span>{isUrduReceipt ? 'کل نیا کھاتہ بقایا:' : 'Net Khata Due:'}</span>
                      <span className="font-mono">{currency} {Number(invoice.customer_balance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div className="border border-gray-300 rounded-xs p-1 text-[8px] text-gray-600 leading-snug">
                  <div className="font-bold text-gray-800 mb-0.5">{isUrduReceipt ? 'وارنٹی و شرائط:' : 'Warranty & Terms:'}</div>
                  <p>{isUrduReceipt ? '7 دن چیک وارنٹی برائے ان سیلڈ سامان۔ برانڈڈ اشیاء کی کمپنی وارنٹی۔ جلنے یا ٹوٹنے پر وارنٹی لاگو نہیں۔ سامان بغیر بل واپس نہ ہوگا۔' : store.receipt_footer}</p>
                </div>
              </div>

              {/* Right Column: Calculations Table */}
              <div className="border border-black rounded-xs p-1.5 bg-gray-50 text-[9.5px] space-y-0.5">
                <div className="flex justify-between text-gray-700">
                  <span>{isUrduReceipt ? 'سب ٹوٹل:' : 'Subtotal:'}</span>
                  <span className="font-mono font-medium">{currency} {(Number(invoice.subtotal || 0) + Number(invoice.extra_charges || 0)).toLocaleString()}</span>
                </div>

                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-gray-800">
                    <span>{isUrduReceipt ? 'رعایت / ڈسکاؤنٹ:' : 'Discount:'}</span>
                    <span className="font-mono font-semibold">- {currency} {invoice.discount_amount?.toLocaleString()}</span>
                  </div>
                )}

                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-gray-800">
                    <span>{isUrduReceipt ? 'سیلز ٹیکس:' : 'Tax:'} ({invoice.tax_rate}%):</span>
                    <span className="font-mono">+ {currency} {invoice.tax_amount?.toLocaleString()}</span>
                  </div>
                )}

                {Number(invoice.shipping_cost || 0) > 0 && (
                  <div className="flex justify-between text-gray-800">
                    <span>{isUrduReceipt ? 'کرایہ / کوریئر:' : 'Shipping:'}</span>
                    <span className="font-mono font-semibold">+ {currency} {Number(invoice.shipping_cost).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-xs md:text-sm border-t border-b border-black py-0.5 my-0.5 text-black bg-white px-1">
                  <span>{isUrduReceipt ? 'کل رقم (Grand Total):' : 'NET TOTAL:'}</span>
                  <span className="font-mono">{currency} {invoice.grand_total?.toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                  <span className="font-medium text-gray-800">{isUrduReceipt ? 'وصول ہوئی رقم:' : 'Amount Paid:'}</span>
                  <span className="font-mono font-bold text-black">{currency} {invoice.paid_amount?.toLocaleString()}</span>
                </div>

                {invoice.balance_due > 0 ? (
                  <div className="flex justify-between font-bold text-[10.5px] text-red-700 bg-red-50 border border-red-500 px-1 py-0.5 rounded-xs">
                    <span>{isUrduReceipt ? 'بقایا واجب الادا:' : 'Balance Due:'}</span>
                    <span className="font-mono font-black">{currency} {invoice.balance_due?.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-bold text-[9px] text-emerald-800 bg-emerald-50 border border-emerald-500 px-1 py-0.5 rounded-xs">
                    <span>{isUrduReceipt ? 'ادائیگی:' : 'Status:'}</span>
                    <span className="font-black uppercase">{isUrduReceipt ? 'مکمل ادا شدہ' : 'PAID IN FULL'}</span>
                  </div>
                )}

                {invoice.change_amount > 0 && (
                  <div className="flex justify-between font-bold text-[9px] text-gray-900">
                    <span>{isUrduReceipt ? 'بقایا واپسی:' : 'Change Returned:'}</span>
                    <span className="font-mono">{currency} {invoice.change_amount?.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Formal Wholesale Signatures Section */}
            <div className={`grid grid-cols-2 gap-6 ${receiptWidth === 'a4' ? 'pt-8 text-[10px]' : 'pt-4 text-[9px]'}`}>
              <div className="text-center">
                <div className="border-t border-dashed border-gray-400 pt-0.5 font-semibold text-gray-800">
                  {isUrduReceipt ? 'دستخط گاہک (Customer Signature)' : 'Customer Signature'}
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-dashed border-gray-400 pt-0.5 font-semibold text-gray-800">
                  {isUrduReceipt ? 'دستخط و مہر دکاندار (Authorized Signature)' : 'Authorized Signature & Stamp'}
                </div>
              </div>
            </div>

            {/* Footer Barcode & Thanks */}
            <div className="text-center pt-1 border-t border-gray-300">
              <div className="py-0.5">
                {renderSvgBarcode(invoice.invoice_number)}
                <div className="text-[8px] font-mono font-bold text-gray-800 tracking-wider">
                  *{invoice.invoice_number}*
                </div>
              </div>
              <p className="text-[9px] font-black uppercase text-black mt-0.5">
                {isUrduReceipt ? '*** آپ کے کاروبار کا شکریہ! ***' : '*** THANK YOU FOR YOUR BUSINESS! ***'}
              </p>
            </div>
          </div>
        ) : (
          /* =========================================================================
             STANDARD / COMPACT THERMAL ROLL LAYOUT (44mm / 50mm / 58mm / 80mm)
             ========================================================================= */
          (() => {
            const is44mm = receiptWidth === '44mm';
            const is50mm = receiptWidth === '50mm' || receiptWidth === '58mm';

            return (
              <div className="text-black space-y-1">
                {/* Printable Watermark for Voided Invoices */}
                {(invoice.status === 'void' || invoice.status === 'cancelled') && (
                  <div className="border-2 border-black text-black font-black text-center text-xs py-0.5 mb-1 bg-gray-200 uppercase tracking-widest font-urdu">
                    {isUrduReceipt ? '*** منسوخ شدہ بل (VOIDED) ***' : '*** VOIDED / CANCELLED ***'}
                  </div>
                )}

                {/* Header Branding (Compact & Standard) */}
                <div className="text-center border-b border-dashed border-black pb-1 mb-1">
                  <h1 className={`${is44mm ? 'text-[11px]' : is50mm ? 'text-xs' : 'text-xs md:text-sm'} font-black tracking-tight uppercase text-black leading-tight`}>
                    {store.store_name}
                  </h1>
                  {store.store_address && (
                    <p className={`${is44mm ? 'text-[7px]' : 'text-[7.5px] md:text-[8px]'} text-black leading-snug mt-0.5 font-medium`}>
                      {store.store_address}
                    </p>
                  )}
                  <div className={`${is44mm ? 'text-[7px]' : 'text-[8px] md:text-[8.5px]'} font-bold text-black mt-0.5 flex flex-wrap justify-center items-center gap-x-2`}>
                    {store.store_phone && (
                      <span>{isUrduReceipt ? `فون: ${store.store_phone}` : `Tel: ${store.store_phone}`}</span>
                    )}
                    {store.tax_ntn && (
                      <span>{isUrduReceipt ? `این ٹی این: ${store.tax_ntn}` : `NTN: ${store.tax_ntn}`}</span>
                    )}
                  </div>
                </div>

                {/* Prominent Compact Bill Header */}
                <div className={`border-b border-dashed border-black pb-1 mb-1 ${is44mm ? 'text-[7.5px]' : 'text-[8.5px] md:text-[9px]'} space-y-0.5`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-black text-black ${is44mm ? 'text-[9.5px]' : 'text-[10.5px] md:text-xs'} font-mono`}>
                      {isUrduReceipt ? `بل نمبر: #${displayInvNo}` : `BILL #: #${displayInvNo}`}
                      {Number(invoice.balance_due || 0) > 0 && (
                        <span className="ml-1 text-[7px] bg-black text-white px-0.5 py-0.2 rounded-xs font-sans">
                          {isUrduReceipt ? 'ادھار' : 'UDHAR'}
                        </span>
                      )}
                    </span>
                    <span className={`font-mono ${is44mm ? 'text-[7px]' : 'text-[8px] md:text-[8.5px]'} text-black font-semibold`}>
                      {formatDate(invoice.created_at)}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center ${is44mm ? 'text-[7px]' : 'text-[8px] md:text-[8.5px]'}`}>
                    <span className="text-black font-medium truncate max-w-[65%]">
                      {isUrduReceipt ? 'گاہک: ' : 'Cust: '}
                      <strong className="font-bold">{getCustomerDisplayName(invoice.customer_name, isUrduReceipt)}</strong>
                      {invoice.customer_phone ? ` (${invoice.customer_phone})` : ''}
                    </span>
                    <span className="text-black font-medium">
                      {isUrduReceipt ? 'کاؤنٹر: ' : 'Cashier: '}
                      <span className="font-semibold">{invoice.cashier_name ? invoice.cashier_name.split(' ')[0] : (isUrduReceipt ? 'ایڈمن' : 'Admin')}</span>
                    </span>
                  </div>
                </div>

                {/* Itemized Table */}
                <table className={`w-full mb-1 ${is44mm ? 'text-[7.5px]' : 'text-[8.5px] md:text-[9px]'} leading-tight`}>
                  <thead>
                    <tr className="border-b border-black font-black text-black">
                      <th className={`py-0.5 ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                        {isUrduReceipt ? 'تفصیل' : 'Item'}
                      </th>
                      <th className={`py-0.5 text-center ${is44mm ? 'w-5' : 'w-7'}`}>{isUrduReceipt ? 'تعداد' : 'Qty'}</th>
                      <th className={`py-0.5 text-right ${is44mm ? 'w-9' : 'w-12 md:w-14'}`}>{isUrduReceipt ? 'ریٹ' : 'Rate'}</th>
                      <th className={`py-0.5 text-right ${is44mm ? 'w-11' : 'w-14 md:w-16'}`}>{isUrduReceipt ? 'ٹوٹل' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-gray-300">
                    {invoice.items?.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="align-top">
                          <td className={`py-0.5 pr-0.5 font-bold text-black ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                            <div className="break-words leading-tight">{item.product_name}</div>
                            {item.warranty_months > 0 && (
                              <span className={`block ${is44mm ? 'text-[6.5px]' : 'text-[7px] md:text-[7.5px]'} font-normal text-gray-700`}>
                                [{item.warranty_months} {isUrduReceipt ? 'ماہ وارنٹی' : 'M Warranty'}]
                              </span>
                            )}
                          </td>
                          <td className="py-0.5 text-center font-mono font-semibold">{item.quantity}</td>
                          <td className="py-0.5 text-right font-mono font-medium">{item.unit_price?.toLocaleString()}</td>
                          <td className="py-0.5 text-right font-mono font-bold text-black">
                            {item.total_price?.toLocaleString()}
                          </td>
                        </tr>

                        {/* Serial Numbers Row */}
                        {item.serial_numbers && item.serial_numbers.length > 0 && (
                          <tr>
                            <td colSpan="4" className={`pb-0.5 ${is44mm ? 'text-[6.5px]' : 'text-[7px] md:text-[7.5px]'} text-gray-800 font-mono ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                              <span className="font-bold">S/N: </span>
                              {item.serial_numbers.map((sn, sidx) => {
                                const serialText = typeof sn === 'object' ? sn.serial_number : sn;
                                return (
                                  <span key={sidx} className="mr-1 inline-block font-semibold">
                                    {serialText}{sidx < item.serial_numbers.length - 1 ? ', ' : ''}
                                  </span>
                                );
                              })}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>

                {/* Totals & Breakdown */}
                <div className={`border-t border-black pt-0.5 space-y-0.5 ${is44mm ? 'text-[7.5px]' : 'text-[8.5px] md:text-[9px]'}`}>
                  <div className="flex justify-between font-medium text-black">
                    <span>{isUrduReceipt ? `آئٹمز: ${totalItemsCount} (تعداد: ${totalQtyCount})` : `Items: ${totalItemsCount} (Qty: ${totalQtyCount})`}</span>
                    <span className="font-mono">{currency} {(Number(invoice.subtotal || 0) + Number(invoice.extra_charges || 0)).toLocaleString()}</span>
                  </div>

                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-black">
                      <span>{isUrduReceipt ? 'رعایت / ڈسکاؤنٹ:' : 'Discount:'}</span>
                      <span className="font-mono font-semibold">- {currency} {invoice.discount_amount?.toLocaleString()}</span>
                    </div>
                  )}

                  {invoice.tax_amount > 0 && (
                    <div className="flex justify-between text-black">
                      <span>{isUrduReceipt ? `سیلز ٹیکس (${invoice.tax_rate}%):` : `Tax (${invoice.tax_rate}%):`}</span>
                      <span className="font-mono">+ {currency} {invoice.tax_amount?.toLocaleString()}</span>
                    </div>
                  )}

                  {Number(invoice.shipping_cost || 0) > 0 && (
                    <div className="flex justify-between text-black">
                      <span>{isUrduReceipt ? 'کرایہ / کوریئر:' : 'Shipping:'}</span>
                      <span className="font-mono font-semibold">+ {currency} {Number(invoice.shipping_cost).toLocaleString()}</span>
                    </div>
                  )}

                  {/* NET GRAND TOTAL */}
                  <div className={`flex justify-between font-black ${is44mm ? 'text-[10px]' : 'text-[11px] md:text-xs'} border-t border-b border-black py-0.5 my-0.5 text-black`}>
                    <span>{isUrduReceipt ? 'کل بل رقم:' : 'TOTAL AMOUNT:'}</span>
                    <span className={`font-mono ${is44mm ? 'text-[11px]' : 'text-xs md:text-sm'}`}>{currency} {invoice.grand_total?.toLocaleString()}</span>
                  </div>

                  <div className={`flex justify-between ${is44mm ? 'text-[7.5px]' : 'text-[8.5px] md:text-[9px]'}`}>
                    <span className="font-medium text-black">
                      {isUrduReceipt ? 'وصول رقم' : 'Paid / Received'} ({invoice.payment_method === 'cash' ? (isUrduReceipt ? 'نقد' : 'CASH') : invoice.payment_method === 'credit' ? (isUrduReceipt ? 'ادھار کھاتہ' : 'CREDIT') : invoice.payment_method?.toUpperCase()}):
                    </span>
                    <span className="font-mono font-bold text-black">
                      {currency} {invoice.paid_amount?.toLocaleString()}
                    </span>
                  </div>

                  {invoice.change_amount > 0 && (
                    <div className={`flex justify-between font-semibold ${is44mm ? 'text-[7px]' : 'text-[8px] md:text-[8.5px]'} text-black`}>
                      <span>{isUrduReceipt ? 'بقایا واپسی (Change):' : 'Change Return:'}</span>
                      <span className="font-mono">{currency} {invoice.change_amount?.toLocaleString()}</span>
                    </div>
                  )}

                  {/* UDHAR / BAQAYA WARNING (ONLY IF BALANCE DUE > 0) */}
                  {invoice.balance_due > 0 && (
                    <div className={`flex justify-between font-black ${is44mm ? 'text-[8px]' : 'text-[9px] md:text-[9.5px]'} text-black border border-black px-1 py-0.5 rounded-xs my-0.5`}>
                      <span>{isUrduReceipt ? '⚠️ بقایا ادھار واجب الادا:' : '⚠️ UDHAR / BALANCE DUE:'}</span>
                      <span className="font-mono">{currency} {invoice.balance_due?.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* CUSTOMER KHATA / LEDGER (ONLY FOR REGISTERED CUSTOMERS WITH ACTIVE BALANCE/UDHAR) */}
                {Number(invoice.show_previous_balance ?? 1) === 1 &&
                 Boolean(invoice.customer_id) &&
                 (Number(invoice.customer_balance || 0) > 0 || Number(invoice.balance_due || 0) > 0 || Number(invoice.previous_customer_balance || 0) > 0) && (
                  <div className={`border border-dashed border-black rounded-xs p-1 my-0.5 bg-gray-50 ${is44mm ? 'text-[7px]' : 'text-[8px] md:text-[8.5px]'} space-y-0.5`}>
                    <div className={`font-black text-center border-b border-gray-300 pb-0.5 uppercase tracking-wider ${is44mm ? 'text-[6.5px]' : 'text-[7.5px] md:text-[8px]'} text-black`}>
                      {isUrduReceipt ? 'گاہک کھاتہ خلاصہ (Customer Khata)' : 'Customer Khata / Ledger Summary'}
                    </div>
                    <div className="flex justify-between text-black">
                      <span>{isUrduReceipt ? 'پچھلا بقایا:' : 'Pichla Udhar (Prev Bal):'}</span>
                      <span className="font-mono font-semibold">
                        {currency} {Number(invoice.previous_customer_balance !== undefined && invoice.previous_customer_balance !== null
                          ? invoice.previous_customer_balance
                          : Math.max(0, (Number(invoice.customer_balance) || 0) - (Number(invoice.balance_due) || 0))
                        ).toLocaleString()}
                      </span>
                    </div>
                    {Number(invoice.balance_due || 0) > 0 && (
                      <div className="flex justify-between text-black">
                        <span>{isUrduReceipt ? 'اس بل کا نیا ادھار:' : 'This Bill Due:'}</span>
                        <span className="font-mono font-semibold">
                          + {currency} {Number(invoice.balance_due).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className={`flex justify-between font-black text-black pt-0.5 border-t border-gray-300 ${is44mm ? 'text-[7.5px]' : 'text-[8.5px] md:text-[9px]'}`}>
                      <span>{isUrduReceipt ? 'کل نیا کھاتہ بقایا:' : 'Total Khata Balance:'}</span>
                      <span className="font-mono text-black">
                        {currency} {Number(invoice.customer_balance || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Barcode & Footer Notice */}
                <div className="text-center border-t border-dashed border-black mt-1 pt-1 space-y-0.5">
                  <div className="receipt-barcode">
                    {renderSvgBarcode(invoice.invoice_number)}
                    <div className={`${is44mm ? 'text-[6.5px]' : 'text-[7.5px]'} font-mono font-bold text-black tracking-wider`}>
                      *{invoice.invoice_number}*
                    </div>
                  </div>

                  <p className={`${is44mm ? 'text-[6.5px]' : 'text-[7.5px]'} text-gray-800 leading-tight px-0.5 font-urdu`}>
                    {isUrduReceipt
                      ? 'نوٹ: 7 دن چیک وارنٹی۔ جلنے یا ٹوٹنے پر وارنٹی ختم۔ بل کے بغیر کلیم نہیں ہوگا۔'
                      : (store.receipt_footer?.length > 100
                          ? 'Note: 7 days check warranty. Physical/burn damage voids warranty. Original slip required for claims.'
                          : store.receipt_footer)}
                  </p>

                  <p className={`${is44mm ? 'text-[7px]' : 'text-[8px]'} font-black uppercase tracking-wide text-black font-urdu`}>
                    {isUrduReceipt ? '*** تشریف آوری کا شکریہ! ***' : '*** THANK YOU FOR YOUR BUSINESS! ***'}
                  </p>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
