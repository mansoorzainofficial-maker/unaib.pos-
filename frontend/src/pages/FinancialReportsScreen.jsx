import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  CreditCard,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  ShieldCheck,
  Printer,
  Scale,
  Percent,
  CheckCircle2,
  FileText,
  Building2,
  ArrowRight
} from 'lucide-react';

export default function FinancialReportsScreen() {
  const { isUrdu } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'tax'
  const [period, setPeriod] = useState('this_month'); // 'today', 'this_month', 'last_30_days'
  const [reportData, setReportData] = useState(null);
  const [taxData, setTaxData] = useState(null);
  const [storeSettings, setStoreSettings] = useState({});
  const [taxSubTab, setTaxSubTab] = useState('sales'); // 'sales' or 'purchases'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAllReports();
  }, [period]);

  const loadAllReports = async () => {
    setLoading(true);
    setError('');
    try {
      const [finRes, taxRes, setRes] = await Promise.all([
        api.reports.getSummary({ period }),
        api.reports.getTaxReport({ period }),
        api.settings.get().catch(() => ({ success: false }))
      ]);

      if (finRes.success) setReportData(finRes);
      if (taxRes.success) setTaxData(taxRes);
      if (setRes?.success && setRes?.settings) setStoreSettings(setRes.settings);
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTaxReport = () => {
    window.print();
  };

  const summary = reportData?.summary || {};
  const paymentBreakdown = reportData?.payment_breakdown || [];
  const topProducts = reportData?.top_products || [];

  const taxSummary = taxData?.summary || {};
  const salesInvoices = taxData?.sales_tax_invoices || [];
  const purchaseBills = taxData?.purchase_tax_bills || [];

  const periodLabels = {
    today: isUrdu ? 'آج کی تاریخ' : 'Today (Aj Ki Tareekh)',
    this_month: isUrdu ? 'اس مہینے کا ریکارڈ' : 'This Month (Is Mahine Ka Record)',
    last_30_days: isUrdu ? 'گزشتہ 30 دن' : 'Last 30 Days (Pichle 30 Din)'
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-100 text-slate-800 p-4 space-y-4 select-text">
      {/* Top Navigation & Main Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs no-print">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {activeTab === 'overview' ? (
                <>
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span>{isUrdu ? 'مالیاتی رپورٹس اور نفع و نقصان کا تفصیلی جائزہ' : 'Financial Reports & Profit / Loss Analysis'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>{isUrdu ? 'ٹیکس اور ایف بی آر / جی ایس ٹی آڈٹ رجسٹر (ان پٹ اور آؤٹ پٹ ٹیکس)' : 'Tax & FBR / GST Audit Ledger (Input & Output Tax)'}</span>
                </>
              )}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === 'overview'
              ? (isUrdu ? 'حقیقی فروخت کی آمدنی، مال کی خریداری لاگت (COGS)، دکان کے اخراجات اور خالص منافع' : 'Real-time sales revenue, inventory cost of goods (COGS), operational expenses, and net margins')
              : (isUrdu ? 'فروخت پر وصول شدہ ٹیکس (آؤٹ پٹ) اور خریداری پر ادا کردہ ٹیکس (ان پٹ) کا مکمل حساب و واجبات' : 'Complete tracking of Output Tax (Collected on Sales) vs Input Tax (Paid on Purchases) & Net Liability')}
          </p>
        </div>

        {/* Tab & Period Pickers */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Tab Switcher */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'نفع و نقصان' : 'Profit & Loss'}</span>
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tax'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'ٹیکس ریکارڈ و آڈٹ' : 'Tax Record & Audit'}</span>
            </button>
          </div>

          {/* Period Filter */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
            {[
              { id: 'today', label: isUrdu ? 'آج' : 'Today' },
              { id: 'this_month', label: isUrdu ? 'اس مہینے' : 'This Month' },
              { id: 'last_30_days', label: isUrdu ? '30 دن' : '30 Days' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  period === p.id
                    ? activeTab === 'overview'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {activeTab === 'tax' && (
            <button
              onClick={handlePrintTaxReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Print Tax Audit Report for Tax Accountant or Filing"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'ٹیکس رپورٹ پرنٹ کریں' : 'Print Tax Report'}</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: FINANCIAL OVERVIEW (PROFIT & LOSS)                                */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* KPI CARDS GRID - Clean Uizard Style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {/* 1. Total Sales - Ocean Blue Card */}
            <div className="bg-blue-600 p-4 rounded-2xl shadow-sm shadow-blue-500/20 flex flex-col justify-between text-white min-h-[135px]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100 block">
                  {isUrdu ? 'کل فروخت (آمدنی)' : 'Total Sales'}
                </span>
                <div className="text-xl lg:text-2xl font-black font-mono text-white mt-1">
                  Rs. {summary.total_revenue?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-blue-100 mt-0.5 font-medium">
                  {summary.total_invoices || 0} {isUrdu ? 'انوائسز' : 'Invoices'}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 2. Net Clean Profit - Fresh Teal Card */}
            <div className="bg-teal-500 p-4 rounded-2xl shadow-sm shadow-teal-500/20 flex flex-col justify-between text-white min-h-[135px]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-100 block">
                  {isUrdu ? 'خالص بچت و منافع' : 'Net Clean Profit'}
                </span>
                <div className="text-xl lg:text-2xl font-black font-mono text-white mt-1">
                  Rs. {summary.net_profit?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-teal-100 font-medium mt-0.5">
                  {summary.profit_margin || 0}% {isUrdu ? 'منافع کی شرح' : 'Profit Margin'}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 3. Gross Profit - Soft Indigo Card */}
            <div className="bg-indigo-500 p-4 rounded-2xl shadow-sm shadow-indigo-500/20 flex flex-col justify-between text-white min-h-[135px]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100 block">
                  {isUrdu ? 'مجموعی مارجن' : 'Gross Margin'}
                </span>
                <div className="text-xl lg:text-2xl font-black font-mono text-white mt-1">
                  Rs. {summary.gross_profit?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-indigo-100 font-medium mt-0.5">
                  {isUrdu ? 'فروخت منفی اصل خریداری' : 'Revenue - COGS'}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 4. Cost of Goods (COGS) - Clean White Card */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between min-h-[135px]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  {isUrdu ? 'مال کی لاگتِ خریداری (COGS)' : 'Cost of Goods (COGS)'}
                </span>
                <div className="text-xl lg:text-2xl font-black font-mono text-slate-800 mt-1">
                  Rs. {summary.total_cogs?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-medium">
                  {isUrdu ? 'فروخت شدہ سامان کی خریداری' : 'Inventory purchase cost'}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 5. Operating Expenses - Clean White Card */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between min-h-[135px]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  {isUrdu ? 'دکان کے کل اخراجات' : 'Operating Expenses'}
                </span>
                <div className="text-xl lg:text-2xl font-black font-mono text-slate-800 mt-1">
                  Rs. {summary.total_expenses?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-medium">
                  {isUrdu ? 'کرایہ، بلز، چائے و ملازمین' : 'Rent, bills, staff & misc'}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* LOWER SECTION: TOP ACCESSORIES & PAYMENT BREAKDOWN */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Selling Accessories */}
            <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                <Award className="w-4 h-4 text-amber-500" />
                <span>{isUrdu ? 'سب سے زیادہ فروخت ہونے والا سامان' : 'Top Performing Computer Accessories'}</span>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 pl-3">{isUrdu ? 'آئٹم کا نام' : 'Accessory'}</th>
                    <th className="py-2.5 text-center">{isUrdu ? 'تعداد' : 'Qty Sold'}</th>
                    <th className="py-2.5 text-right">{isUrdu ? 'آمدنی' : 'Revenue'}</th>
                    <th className="py-2.5 pr-3 text-right">{isUrdu ? 'منافع' : 'Gross Margin'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-400">
                        {isUrdu ? 'اس مدت میں کوئی فروخت ریکارڈ نہیں ہوئی۔' : 'No sales recorded for this period.'}
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pl-3 font-semibold text-slate-900">{p.product_name}</td>
                        <td className="py-2.5 text-center font-mono text-slate-700">{p.total_qty_sold}</td>
                        <td className="py-2.5 text-right font-mono text-slate-700">
                          Rs. {p.total_revenue?.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono font-bold text-emerald-600">
                          Rs. {p.total_profit?.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>{isUrdu ? 'ادائیگی کے ذرائع و کھاتے' : 'Payment Channels'}</span>
              </div>

              <div className="space-y-2">
                {paymentBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    {isUrdu ? 'کوئی ادائیگی ریکارڈ نہیں ہے۔' : 'No payment data available.'}
                  </p>
                ) : (
                  paymentBreakdown.map((pm, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold uppercase tracking-wider text-slate-800">
                          {pm.payment_method === 'cash' ? (isUrdu ? 'نقد (کیش)' : 'Cash') :
                           pm.payment_method === 'udhar' ? (isUrdu ? 'ادھار (کھاتہ)' : 'Udhar') :
                           pm.payment_method === 'bank' ? (isUrdu ? 'بینک ٹرانسفر' : 'Bank') : pm.payment_method}
                        </div>
                        <div className="text-[10px] text-slate-500">{pm.count} {isUrdu ? 'بلز' : 'transactions'}</div>
                      </div>
                      <div className="font-mono font-bold text-emerald-600 text-sm">
                        Rs. {pm.total?.toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TAX & FBR / GST AUDIT LEDGER (INPUT & OUTPUT TAX)                 */}
      {/* ========================================================================= */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          {/* Printable Business Tax Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {storeSettings.store_name || (isUrdu ? 'عنائب کمپیوٹر ایکسیسریز' : 'Unaib Computer Accessories')} — {isUrdu ? 'ٹیکس لیجر اور آڈٹ گوشوارہ' : 'Tax Ledger & Audit Statement'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isUrdu ? 'آڈٹ کی مدت:' : 'Audit Period:'} <strong className="text-slate-700">{periodLabels[period] || period}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 font-medium">NTN: </span>
                <span className="font-mono font-bold text-slate-800">
                  {storeSettings.tax_ntn || (isUrdu ? 'درج نہیں' : 'Not Configured')}
                </span>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-slate-500 font-medium">STRN: </span>
                <span className="font-mono font-bold text-slate-800">
                  {storeSettings.tax_strn || (isUrdu ? 'درج نہیں' : 'Not Configured')}
                </span>
              </div>
            </div>
          </div>

          {/* 3 TALL UIZARD TAX KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CARD 1: OUTPUT TAX (SALES) - Ocean Blue */}
            <div className="bg-blue-600 p-5 rounded-2xl shadow-sm shadow-blue-500/20 flex flex-col justify-between text-white min-h-[155px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                    {isUrdu ? 'آؤٹ پٹ ٹیکس (فروخت پر وصول شدہ)' : 'Output Tax (Sales Tax Collected)'}
                  </span>
                  <Receipt className="w-5 h-5 text-blue-200" />
                </div>
                <div className="text-2xl lg:text-3xl font-black font-mono text-white mt-2">
                  Rs. {taxSummary.total_output_tax?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-blue-100 font-medium mt-1">
                  {isUrdu ? 'قابلِ ٹیکس فروخت:' : 'Taxable Sales:'} Rs. {taxSummary.total_taxable_sales?.toLocaleString() || 0}
                </div>
              </div>
              <div className="pt-2 border-t border-blue-500/50 text-[11px] text-blue-200 flex justify-between">
                <span>{isUrdu ? 'کل ٹیکس انوائسز:' : 'Total Tax Invoices:'}</span>
                <span className="font-mono font-bold text-white">{taxSummary.total_tax_invoices || 0}</span>
              </div>
            </div>

            {/* CARD 2: INPUT TAX (PURCHASES) - Fresh Teal */}
            <div className="bg-teal-600 p-5 rounded-2xl shadow-sm shadow-teal-500/20 flex flex-col justify-between text-white min-h-[155px]">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-100">
                    {isUrdu ? 'ان پٹ ٹیکس (خریداری پر ادا شدہ)' : 'Input Tax (Purchase Tax Paid)'}
                  </span>
                  <Layers className="w-5 h-5 text-teal-200" />
                </div>
                <div className="text-2xl lg:text-3xl font-black font-mono text-white mt-2">
                  Rs. {taxSummary.total_input_tax?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-teal-100 font-medium mt-1">
                  {isUrdu ? 'قابلِ ٹیکس خریداری:' : 'Taxable Purchases:'} Rs. {taxSummary.total_taxable_purchases?.toLocaleString() || 0}
                </div>
              </div>
              <div className="pt-2 border-t border-teal-500/50 text-[11px] text-teal-200 flex justify-between">
                <span>{isUrdu ? 'کل ٹیکس خریداری بل:' : 'Total Tax Purchase Bills:'}</span>
                <span className="font-mono font-bold text-white">{taxSummary.total_tax_purchases || 0}</span>
              </div>
            </div>

            {/* CARD 3: NET TAX BALANCE / LIABILITY - Soft Indigo or Emerald */}
            <div className={`p-5 rounded-2xl shadow-sm flex flex-col justify-between text-white min-h-[155px] ${
              taxSummary.is_credit
                ? 'bg-emerald-600 shadow-emerald-500/20'
                : 'bg-indigo-600 shadow-indigo-500/20'
            }`}>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100">
                    {taxSummary.is_credit
                      ? (isUrdu ? 'ٹیکس کریڈٹ (حکومت کی طرف جمع / ایڈجسٹمنٹ)' : 'Tax Credit (Carry Forward / Refund)')
                      : (isUrdu ? 'واجب الادا ٹیکس (ایف بی آر / حکومتی واجبات)' : 'Net Tax Payable (Govt / FBR Due)')}
                  </span>
                  <Scale className="w-5 h-5 text-indigo-200" />
                </div>
                <div className="text-2xl lg:text-3xl font-black font-mono text-white mt-2">
                  Rs. {Math.abs(taxSummary.net_tax_payable || 0).toLocaleString()}
                </div>
                <div className="text-xs text-indigo-100 font-medium mt-1">
                  {taxSummary.is_credit
                    ? (isUrdu ? 'خریدار ٹیکس فروخت سے زیادہ ہے (کریڈٹ برقرار رہے گا)' : 'Input Tax exceeded Output Tax (Credit to carry forward)')
                    : (isUrdu ? 'آؤٹ پٹ ٹیکس منفی ان پٹ ٹیکس = قابلِ ادائیگی خالص ٹیکس' : 'Output Tax - Input Tax = Net Payable to Tax Authority')}
                </div>
              </div>
              <div className="pt-2 border-t border-white/20 text-[11px] text-white/90 flex justify-between">
                <span>{isUrdu ? 'حیثیت:' : 'Status:'}</span>
                <span className="font-bold uppercase tracking-wider">
                  {taxSummary.is_credit ? (isUrdu ? '★ ٹیکس کریڈٹ' : '★ TAX CREDIT') : (isUrdu ? '⚠️ قابلِ ادائیگی ٹیکس' : '⚠️ NET PAYABLE')}
                </span>
              </div>
            </div>
          </div>

          {/* RECONCILIATION SUMMARY STRIP */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold font-mono">
                {isUrdu ? 'آؤٹ پٹ:' : 'Output Tax:'} Rs. {taxSummary.total_output_tax?.toLocaleString() || 0}
              </span>
              <span className="text-slate-400 font-black font-mono">−</span>
              <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded font-bold font-mono">
                {isUrdu ? 'ان پٹ:' : 'Input Tax:'} Rs. {taxSummary.total_input_tax?.toLocaleString() || 0}
              </span>
              <span className="text-slate-400 font-black font-mono">=</span>
              <span className={`px-2.5 py-0.5 rounded font-black font-mono ${
                taxSummary.is_credit
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
              }`}>
                {isUrdu ? 'خالص:' : 'Net:'} Rs. {Math.abs(taxSummary.net_tax_payable || 0).toLocaleString()} {taxSummary.is_credit ? (isUrdu ? '(کریڈٹ)' : '(Credit)') : (isUrdu ? '(قابلِ ادائیگی)' : '(Payable)')}
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              {isUrdu
                ? 'ٹیکس قانون کا اصول: اپنے بیچے ہوئے مال کا ٹیکس جمع کریں اور خریداری پر ادا شدہ ٹیکس منہا کریں۔'
                : 'Tax law calculation: Apne beche hue maal ka tax jama karein aur khareedari par ada kiya hua tax minus karein.'}
            </p>
          </div>

          {/* DETAILED TRANSACTION BREAKDOWN TABS & TABLES */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Table Selector Sub-tab */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300 text-xs font-semibold">
                <button
                  onClick={() => setTaxSubTab('sales')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    taxSubTab === 'sales'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'سیلز ٹیکس انوائسز (آؤٹ پٹ ٹیکس)' : 'Sales Tax Invoices (Output Tax)'} [{salesInvoices.length}]</span>
                </button>
                <button
                  onClick={() => setTaxSubTab('purchases')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    taxSubTab === 'purchases'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'خریداری ٹیکس بلز (ان پٹ ٹیکس)' : 'Purchase Tax Bills (Input Tax)'} [{purchaseBills.length}]</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-500 font-medium">
                {isUrdu ? 'صرف وہ ٹرانزیکشنز جن میں ٹیکس شامل ہے' : 'Showing transactions with Tax > Rs. 0'}
              </span>
            </div>

            {/* TAB A: SALES TAX INVOICES TABLE */}
            {taxSubTab === 'sales' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 pl-3">{isUrdu ? 'انوائس #' : 'Invoice #'}</th>
                      <th className="py-2.5 px-2">{isUrdu ? 'تاریخ و وقت' : 'Date & Time'}</th>
                      <th className="py-2.5 px-2">{isUrdu ? 'گاہک / پارٹی' : 'Customer Party'}</th>
                      <th className="py-2.5 px-2">{isUrdu ? 'طریقہ ادائیگی' : 'Payment Method'}</th>
                      <th className="py-2.5 px-2 text-right">{isUrdu ? 'ٹیکس کے بغیر رقم' : 'Taxable Amount'}</th>
                      <th className="py-2.5 px-2 text-center">{isUrdu ? 'شرح' : 'Tax Rate'}</th>
                      <th className="py-2.5 px-2 text-right text-blue-700">{isUrdu ? 'آؤٹ پٹ ٹیکس' : 'Output Tax'}</th>
                      <th className="py-2.5 pr-3 text-right">{isUrdu ? 'کل رقم' : 'Grand Total'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-slate-400">
                          {isUrdu ? 'اس مدت میں کوئی سیلز ٹیکس انوائس درج نہیں ہے۔' : 'Is period me koi Sales Tax Invoice darj nahi hai.'}
                        </td>
                      </tr>
                    ) : (
                      salesInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pl-3 font-mono font-bold text-blue-700">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-600 text-[11px]">
                            {inv.created_at}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-900">
                            {(inv.customer_name === 'Walk-in Customer' || !inv.customer_name) ? (isUrdu ? 'عام واک ان گاہک' : 'Walk-in Customer') : inv.customer_name}
                          </td>
                          <td className="py-2.5 px-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                              {inv.payment_method === 'cash' ? (isUrdu ? 'نقد' : 'cash') :
                               inv.payment_method === 'udhar' ? (isUrdu ? 'ادھار' : 'udhar') :
                               inv.payment_method === 'bank' ? (isUrdu ? 'بینک' : 'bank') : inv.payment_method}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                            Rs. {inv.taxable_amount?.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-800">
                            {inv.tax_rate}%
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-blue-700">
                            +Rs. {inv.tax_amount?.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono font-black text-slate-900">
                            Rs. {inv.grand_total?.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB B: PURCHASE TAX BILLS TABLE */}
            {taxSubTab === 'purchases' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 pl-3">{isUrdu ? 'خریداری نمبر' : 'Purchase Order #'}</th>
                      <th className="py-2.5 px-2">{isUrdu ? 'تاریخ خریداری' : 'Purchase Date'}</th>
                      <th className="py-2.5 px-2">{isUrdu ? 'سپلائر / وینڈر' : 'Supplier / Vendor'}</th>
                      <th className="py-2.5 px-2">{isUrdu ? 'سپلائر بل #' : 'Supplier Inv #'}</th>
                      <th className="py-2.5 px-2 text-right">{isUrdu ? 'ٹیکس کے بغیر رقم' : 'Taxable Amount'}</th>
                      <th className="py-2.5 px-2 text-center">{isUrdu ? 'شرح' : 'Tax Rate'}</th>
                      <th className="py-2.5 px-2 text-right text-teal-700">{isUrdu ? 'ان پٹ ٹیکس' : 'Input Tax'}</th>
                      <th className="py-2.5 pr-3 text-right">{isUrdu ? 'کل بل' : 'Total Bill'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseBills.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-slate-400">
                          {isUrdu ? 'اس مدت میں کوئی خریداری ٹیکس بل درج نہیں ہے۔' : 'Is period me koi Purchase Tax Bill darj nahi hai.'}
                        </td>
                      </tr>
                    ) : (
                      purchaseBills.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pl-3 font-mono font-bold text-teal-700">
                            {p.purchase_number}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-600 text-[11px]">
                            {p.purchase_date}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-900">
                            {p.supplier_name}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-600 text-[11px]">
                            {p.supplier_invoice_no || '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                            Rs. {p.taxable_amount?.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-800">
                            {p.tax_rate}%
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-teal-700">
                            +Rs. {p.tax_amount?.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono font-black text-slate-900">
                            Rs. {p.grand_total?.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
