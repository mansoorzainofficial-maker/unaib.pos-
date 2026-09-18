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
  const [receiptWidth, setReceiptWidth] = useState('80mm'); // '58mm' or '80mm'
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

  const store = invoice.store || {
    store_name: 'Unaib Computer Accessories',
    store_tagline: 'Gaming Rigs, High-End Components & Genuine Accessories',
    store_address: 'Shop #14, Ground Floor, Techno City Plaza, I.I. Chundrigar Rd, Karachi',
    store_phone: '+92 300 9258123 / 021-32278910',
    store_email: 'sales@unaibcomputers.com',
    currency_symbol: 'Rs.',
    receipt_footer: 'Warranty Terms: 7 days check warranty for unsealed items. 1-2 year brand warranty for serialized components. Physical/burn damage voids warranty.'
  };

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
    if (!name) return isUrdu ? 'عام واک ان گاہک' : 'Walk-in Customer';
    const lower = String(name).trim().toLowerCase();
    if (lower === 'walk-in customer' || lower === 'walk-in' || lower === 'walk in') {
      return isUrdu ? 'عام واک ان گاہک' : 'Walk-in Customer';
    }
    if (lower.startsWith('walk-in udhar')) {
      return isUrdu ? name.replace(/walk-in udhar/i, 'واک ان ادھار گاہک') : name;
    }
    if (lower === 'valued customer') {
      return isUrdu ? 'محترم گاہک' : 'Valued Customer';
    }
    return name;
  };

  // Item counts
  const totalItemsCount = invoice.items ? invoice.items.length : 0;
  const totalQtyCount = invoice.items ? invoice.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) : 0;

  // Print handler with hardware try-catch protection
  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintError('');
    try {
      if (window.electronAPI?.printReceipt) {
        const res = await window.electronAPI.printReceipt({
          silent: false,
          pageSize: receiptWidth === '58mm' ? { width: 58000, height: 150000 } : { width: 80000, height: 200000 }
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
      msg += `*سامان کا سب ٹوٹل:* ${currency} ${Number(invoice.subtotal || 0).toLocaleString()}\n`;

      if (invoice.discount_amount > 0) {
        msg += `رعایت / ڈسکاؤنٹ: -${currency} ${Number(invoice.discount_amount).toLocaleString()}\n`;
      }

      if (invoice.tax_amount > 0) {
        msg += `سیلز ٹیکس (${invoice.tax_rate}%): +${currency} ${Number(invoice.tax_amount).toLocaleString()}\n`;
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
    msg += `*Subtotal:* ${currency} ${Number(invoice.subtotal || 0).toLocaleString()}\n`;

    if (invoice.discount_amount > 0) {
      msg += `Discount: -${currency} ${Number(invoice.discount_amount).toLocaleString()}\n`;
    }

    if (invoice.tax_amount > 0) {
      msg += `Tax (${invoice.tax_rate}%): +${currency} ${Number(invoice.tax_amount).toLocaleString()}\n`;
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

  // Generate SVG Code-128 Barcode Bars
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

      bars.push(<rect key={`b1-${i}`} x={curX} y="0" width={w1} height="36" fill="#000" />);
      curX += w1 + gap;
      bars.push(<rect key={`b2-${i}`} x={curX} y="0" width={w2} height="36" fill="#000" />);
      curX += w2 + gap;
    }

    return (
      <svg
        viewBox={`0 0 ${curX + 10} 38`}
        className="h-9 mx-auto max-w-[220px]"
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
            <span className="text-[11px] font-semibold text-slate-600">{isUrduReceipt ? 'کاغذ سائز:' : 'Roll:'}</span>
            <div className="inline-flex rounded-lg bg-slate-100 border border-slate-200 p-0.5 text-xs">
              <button
                onClick={() => setReceiptWidth('58mm')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                  receiptWidth === '58mm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                58mm
              </button>
              <button
                onClick={() => setReceiptWidth('80mm')}
                className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
                  receiptWidth === '80mm' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm
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
        className={`bg-white text-black p-4 mt-3 rounded shadow-2xl transition-all select-text border border-gray-300 relative ${
          isUrduReceipt ? 'receipt-urdu font-urdu text-right' : 'font-mono-receipt text-left'
        } ${receiptWidth === '58mm' ? 'w-[280px] text-[10px] leading-tight receipt-58mm' : 'w-[360px] text-xs leading-normal receipt-80mm'}`}
      >
        {/* Printable Watermark for Voided Invoices */}
        {(invoice.status === 'void' || invoice.status === 'cancelled') && (
          <div className="border-4 border-black text-black font-black text-center text-sm py-1 mb-2 bg-gray-200 uppercase tracking-widest font-urdu">
            {isUrduReceipt ? '*** منسوخ شدہ بل (VOIDED BILL) ***' : '*** VOIDED / CANCELLED ***'}
          </div>
        )}

        {/* Header Branding */}
        <div className="text-center border-b-2 border-black pb-2 mb-2">
          <h1 className="text-sm md:text-base font-black tracking-tight uppercase text-black leading-tight">
            {store.store_name}
          </h1>
          <p className="text-[9.5px] text-gray-800 font-bold mt-0.5">{store.store_tagline}</p>
          <p className="text-[9px] text-gray-700 mt-1 leading-snug">{store.store_address}</p>
          <p className="text-[9.5px] text-gray-900 font-semibold mt-0.5">
            {isUrduReceipt ? `فون نمبر / رابطہ: ${store.store_phone}` : `Tel: ${store.store_phone}`}
          </p>
          {store.store_email && <p className="text-[8.5px] text-gray-600">{store.store_email}</p>}
          {(store.tax_ntn || store.tax_strn) && (
            <div className="text-[9px] font-bold text-gray-800 mt-0.5 flex flex-wrap justify-center gap-x-2">
              {store.tax_ntn && <span>{isUrduReceipt ? 'این ٹی این:' : 'NTN:'} {store.tax_ntn}</span>}
              {store.tax_strn && <span>{isUrduReceipt ? 'سیلز ٹیکس نمبر:' : 'STRN:'} {store.tax_strn}</span>}
            </div>
          )}
        </div>

        {/* PROMINENT INVOICE / BILL NUMBER HEADER */}
        <div className="border-2 border-black rounded-sm p-1.5 mb-2 text-center bg-gray-50">
          <div className="text-[9.5px] font-black tracking-widest text-gray-700">
            {invoice.balance_due > 0
              ? (isUrduReceipt ? '★ ادھار سیلز میمو (Credit Bill) ★' : '★ CREDIT / UDHAR SALE MEMO ★')
              : (isUrduReceipt ? '★ نقد فروخت میمو (Cash Bill) ★' : '★ CASH SALES MEMO ★')}
          </div>
          <div className="text-base md:text-lg font-black tracking-tight text-black font-mono">
            {isUrduReceipt ? `بل نمبر: #${displayInvNo}` : `INVOICE NO: #${displayInvNo}`}
          </div>
          <div className="text-[8.5px] text-gray-600 font-mono tracking-wider">
            {isUrduReceipt ? 'حوالہ کوڈ: ' : 'Ref: '}{invoice.invoice_number}
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-[10px] space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-600 font-medium">{isUrduReceipt ? 'تاریخ و وقت:' : 'Date & Time:'}</span>
            <span className="font-mono font-bold text-black">{formatDate(invoice.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 font-medium">{isUrduReceipt ? 'کاؤنٹر کیشئر:' : 'Cashier / Counter:'}</span>
            <span className="font-semibold text-black">{invoice.cashier_name || (isUrduReceipt ? 'ایڈمن کیشئر' : 'Admin Cashier')}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-dotted border-gray-300">
            <span className="text-gray-600 font-medium">{isUrduReceipt ? 'محترم گاہک:' : 'Customer Party:'}</span>
            <span className="font-bold text-black">{getCustomerDisplayName(invoice.customer_name, isUrduReceipt)}</span>
          </div>
          {invoice.customer_phone && (
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">{isUrduReceipt ? 'رابطہ موبائل نمبر:' : 'Contact Phone:'}</span>
              <span className="font-mono font-bold text-black">{invoice.customer_phone}</span>
            </div>
          )}
        </div>

        {/* Itemized Table */}
        <table className="w-full mb-2 text-[10px]">
          <thead>
            <tr className="border-b-2 border-black font-bold text-black">
              <th className={`py-1 ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                {isUrduReceipt ? 'سامان کی تفصیل' : 'Item Description'}
              </th>
              <th className="py-1 text-center w-8">{isUrduReceipt ? 'تعداد' : 'Qty'}</th>
              <th className="py-1 text-right w-16">{isUrduReceipt ? 'ریٹ' : 'Rate'}</th>
              <th className="py-1 text-right w-18">{isUrduReceipt ? 'ٹوٹل' : 'Total'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-gray-300">
            {invoice.items?.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr className="align-top">
                  <td className={`py-1 pr-1 font-semibold text-black ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                    {item.product_name}
                    {item.warranty_months > 0 && (
                      <span className="block text-[8.5px] font-normal text-gray-700">
                        [{item.warranty_months} {isUrduReceipt ? 'ماہ وارنٹی' : 'M Warranty'}]
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-center font-mono font-medium">{item.quantity}</td>
                  <td className="py-1 text-right font-mono font-medium">{item.unit_price?.toLocaleString()}</td>
                  <td className="py-1 text-right font-mono font-bold text-black">
                    {item.total_price?.toLocaleString()}
                  </td>
                </tr>

                {/* Serial Numbers Row */}
                {item.serial_numbers && item.serial_numbers.length > 0 && (
                  <tr>
                    <td colSpan="4" className={`pb-1 text-[8.5px] text-gray-800 font-mono ${isUrduReceipt ? 'text-right' : 'text-left'}`}>
                      <span className="font-bold">{isUrduReceipt ? 'سیریل نمبر: ' : 'S/N: '}</span>
                      {item.serial_numbers.map((sn, sidx) => {
                        const serialText = typeof sn === 'object' ? sn.serial_number : sn;
                        return (
                          <span key={sidx} className="mr-1 inline-block font-semibold">
                            {serialText}
                            {sidx < item.serial_numbers.length - 1 ? '، ' : ''}
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
        <div className="border-t-2 border-black pt-1.5 space-y-0.5 text-[10px]">
          <div className="flex justify-between font-medium text-gray-700">
            <span>{isUrduReceipt ? `سامان: ${totalItemsCount} (تعداد: ${totalQtyCount})` : `Items: ${totalItemsCount} (Qty: ${totalQtyCount})`}</span>
            <span className="font-mono">{isUrduReceipt ? 'سب ٹوٹل: ' : 'Subtotal: '}{currency} {invoice.subtotal?.toLocaleString()}</span>
          </div>

          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-gray-800">
              <span>{isUrduReceipt ? 'رعایت / ڈسکاؤنٹ' : 'Discount'} {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}:</span>
              <span className="font-mono font-semibold">- {currency} {invoice.discount_amount?.toLocaleString()}</span>
            </div>
          )}

          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-gray-800">
              <span>{isUrduReceipt ? 'سیلز ٹیکس' : 'Tax'} ({invoice.tax_rate}%):</span>
              <span className="font-mono">+ {currency} {invoice.tax_amount?.toLocaleString()}</span>
            </div>
          )}

          {/* NET GRAND TOTAL */}
          <div className="flex justify-between font-black text-xs md:text-sm border-t-2 border-b-2 border-black py-1 my-1 text-black">
            <span>{isUrduReceipt ? 'کل واجب الادا رقم:' : 'NET TOTAL AMOUNT:'}</span>
            <span className="font-mono">{currency} {invoice.grand_total?.toLocaleString()}</span>
          </div>

          <div className="flex justify-between text-[10.5px]">
            <span className="font-medium text-gray-800">
              {isUrduReceipt ? 'وصول شدہ رقم' : 'Paid / Received'} ({invoice.payment_method === 'cash' ? (isUrduReceipt ? 'نقد' : 'CASH') : invoice.payment_method === 'credit' ? (isUrduReceipt ? 'ادھار کھاتہ' : 'CREDIT') : invoice.payment_method?.toUpperCase()}):
            </span>
            <span className="font-mono font-bold text-black">
              {currency} {invoice.paid_amount?.toLocaleString()}
            </span>
          </div>

          {/* UDHAR / BAQAYA WARNING BOX */}
          {invoice.balance_due > 0 ? (
            <div className="flex justify-between font-black text-xs text-red-700 bg-red-50 border-2 border-red-600 p-1 rounded-sm my-1">
              <span>{isUrduReceipt ? '⚠️ بقایا ادھار واجب الادا:' : '⚠️ UDHAR / BAQAYA DUE:'}</span>
              <span className="font-mono">{currency} {invoice.balance_due?.toLocaleString()}</span>
            </div>
          ) : (
            <div className="flex justify-between font-bold text-[9.5px] text-emerald-800 bg-emerald-50 border border-emerald-500 px-1 py-0.5 rounded-sm my-1">
              <span>{isUrduReceipt ? 'ادائیگی کی حیثیت:' : 'PAYMENT STATUS:'}</span>
              <span className="font-black uppercase">{isUrduReceipt ? 'مکمل ادا شدہ' : 'PAID IN FULL'}</span>
            </div>
          )}

          {invoice.change_amount > 0 && (
            <div className="flex justify-between font-bold text-[10px] text-gray-900">
              <span>{isUrduReceipt ? 'بقایا واپسی رقم:' : 'Change Returned (Wapis):'}</span>
              <span className="font-mono">{currency} {invoice.change_amount?.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* CUSTOMER KHATA / LEDGER STATEMENT SECTION */}
        {Number(invoice.show_previous_balance ?? 1) === 1 && invoice.customer_balance !== undefined && invoice.customer_balance !== null && (
          <div className="border border-black rounded-sm p-1.5 my-2 bg-gray-50 text-[9.5px] space-y-0.5">
            <div className="font-black text-center border-b border-gray-300 pb-0.5 uppercase tracking-wider text-[9px] text-black">
              {isUrduReceipt ? 'گاہک کا مکمل کھاتہ و لیجر خلاصہ' : 'Customer Khata / Ledger Summary'}
            </div>
            <div className="flex justify-between text-gray-700">
              <span>{isUrduReceipt ? 'پچھلا بقایا ادھار:' : 'Pichla Udhar (Previous Balance):'}</span>
              <span className="font-mono font-semibold">
                {currency} {Number(invoice.previous_customer_balance !== undefined && invoice.previous_customer_balance !== null
                  ? invoice.previous_customer_balance
                  : Math.max(0, (Number(invoice.customer_balance) || 0) - (Number(invoice.balance_due) || 0))
                ).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>{isUrduReceipt ? 'اس بل کا نیا مال:' : 'Naya Maal (This Bill):'}</span>
              <span className="font-mono font-semibold">
                + {currency} {Number(invoice.grand_total || 0).toLocaleString()}
              </span>
            </div>
            {Number(invoice.paid_amount || 0) > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>{isUrduReceipt ? 'اس بل پر وصولی:' : 'Raqam Adaa (Paid):'}</span>
                <span className="font-mono font-semibold text-emerald-800">
                  - {currency} {Number(invoice.paid_amount || 0).toLocaleString()}
                </span>
              </div>
            )}
            {Number(invoice.paid_amount || 0) > Number(invoice.grand_total || 0) ? (
              <div className="flex justify-between text-emerald-950 font-bold bg-emerald-100/80 px-1 py-0.5 rounded-xs">
                <span>{isUrduReceipt ? 'اضافی ادائیگی (کھاتے سے منفی):' : 'Extra Payment (Khate se Minus):'}</span>
                <span className="font-mono">
                  - {currency} {(Number(invoice.paid_amount) - Number(invoice.grand_total)).toLocaleString()}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-gray-700">
                <span>{isUrduReceipt ? 'اس بل کا نیا ادھار:' : 'Is Bill Ka Udhar (Bill Due):'}</span>
                <span className="font-mono font-semibold text-amber-900">
                  + {currency} {(Number(invoice.balance_due) || 0).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between font-black text-black pt-0.5 border-t border-gray-300 text-[10.5px]">
              <span>{isUrduReceipt ? 'کل نیا کھاتہ بقایا واجب الادا:' : 'Kul Baqaya (Total Khata Balance):'}</span>
              <span className="font-mono text-black">
                {currency} {Number(invoice.customer_balance || 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Barcode & Footer Notice */}
        <div className="text-center border-t border-dashed border-gray-400 mt-2.5 pt-2">
          {/* Real Vector Scannable Barcode */}
          <div className="py-1">
            {renderSvgBarcode(invoice.invoice_number)}
            <div className="text-[8.5px] font-mono font-bold text-gray-800 tracking-wider mt-0.5">
              *{invoice.invoice_number}*
            </div>
          </div>

          <p className="text-[8px] text-gray-600 mt-1 leading-tight px-1 font-urdu">
            {isUrduReceipt
              ? 'وارنٹی شرائط: 7 دن چیک وارنٹی۔ برانڈڈ سامان کی کمپنی وارنٹی۔ جلنے یا ٹوٹنے پر وارنٹی لاگو نہیں۔'
              : store.receipt_footer}
          </p>

          <p className="text-[9px] font-black mt-1.5 uppercase tracking-wide text-black font-urdu">
            {isUrduReceipt ? '*** آپ کی تشریف آوری کا بہت شکریہ! ***' : '*** Thank You For Your Business! ***'}
          </p>
        </div>
      </div>
    </div>
  );
}
