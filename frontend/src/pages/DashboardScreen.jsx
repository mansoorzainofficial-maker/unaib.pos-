import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  Wallet,
  AlertTriangle,
  ShoppingCart,
  Truck,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Package,
  CheckCircle2,
  Users,
  Building2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function DashboardScreen({ onNavigate }) {
  const { t, isUrdu } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [chartLoaded, setChartLoaded] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.dashboard.getOverview();
      if (res && res.success) {
        setData(res.data);
        // Trigger chart animation
        setTimeout(() => setChartLoaded(true), 80);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRs = (num) => {
    const val = Math.round(Number(num) || 0);
    return val.toLocaleString('en-PK');
  };

  // Safe defaults
  const summary = data?.summary || {
    today_sales: 0,
    today_invoices: 0,
    drawer: { isOpen: false, expected_cash: 0 },
    low_stock_count: 0,
    total_receivable: 0,
    total_payable: 0
  };

  const dailyTrend = data?.daily_trend || [];
  const topProducts = data?.top_products || [];

  // Chart max value for relative scaling
  const maxSale = useMemo(() => {
    const highest = Math.max(...dailyTrend.map(d => d.sales), 0);
    return highest > 0 ? highest : 1000;
  }, [dailyTrend]);

  const totalWeeklySales = useMemo(() => {
    return dailyTrend.reduce((acc, curr) => acc + (curr.sales || 0), 0);
  }, [dailyTrend]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto select-none p-5 space-y-5">
      {/* Top Header & Quick Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                {isUrdu ? 'کاروباری ڈیش بورڈ و خلاصہ' : 'Business Overview Dashboard'}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Live POS
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {isUrdu
                ? 'آج کی فروخت، کیش گلہ، کم اسٹاک، اور پچھلے ۷ دن کی مکمل کارکردگی'
                : 'Real-time overview of sales, cash drawer, inventory alerts & receivables'}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
            title={isUrdu ? 'تازہ ترین ڈیٹا ریفریش کریں' : 'Refresh Data'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isUrdu ? 'ریفریش' : 'Refresh'}</span>
          </button>

          {/* New Bill Button */}
          <button
            onClick={() => onNavigate && onNavigate('pos')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer active:scale-98"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{isUrdu ? 'نیا بل بنائیں (POS)' : 'New Bill (POS)'}</span>
          </button>

          {/* New GRN Button */}
          <button
            onClick={() => onNavigate && onNavigate('create_grn')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all cursor-pointer active:scale-98"
          >
            <Truck className="w-4 h-4" />
            <span>{isUrdu ? 'نیا مال خریداری (GRN)' : 'New GRN'}</span>
          </button>
        </div>
      </div>

      {/* 1. TOP - 4 SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Total Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'آج کی کل فروخت' : "Today's Sales"}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              Rs. {formatRs(summary.today_sales)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-slate-500 text-[11px] font-medium">
              <Receipt className="w-3 h-3 text-slate-400" />
              <span>{summary.today_invoices} {isUrdu ? 'بل مکمل ہوئے' : 'invoices completed'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Today's Bills Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'آج کے بنے بل' : "Today's Invoices"}
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              {summary.today_invoices}
              <span className="text-xs font-bold text-slate-500 ml-1.5">{isUrdu ? 'آرڈرز' : 'Orders'}</span>
            </div>
            <p className="mt-1 text-slate-500 text-[11px] font-medium">
              {summary.today_invoices > 0
                ? (isUrdu ? 'آج کی کسٹمر ٹرانزیکشنز' : 'Completed customer sales')
                : (isUrdu ? 'آج ابھی کوئی بل نہیں بنا' : 'No bills generated yet today')}
            </p>
          </div>
        </div>

        {/* Card 3: Cash Drawer Status */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'کیش دراز (گلہ)' : 'Cash Drawer Status'}
            </span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              summary.drawer.isOpen
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : 'bg-amber-50 text-amber-600 border-amber-100'
            }`}>
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${summary.drawer.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span className={`text-base font-black ${summary.drawer.isOpen ? 'text-emerald-800' : 'text-amber-800'}`}>
                {summary.drawer.isOpen ? (isUrdu ? 'گلہ کھلا ہے (Active)' : 'Shift Open') : (isUrdu ? 'گلہ بند ہے (Closed)' : 'Shift Closed')}
              </span>
            </div>
            <div className="mt-1 text-slate-600 text-[11px] font-medium">
              {summary.drawer.isOpen ? (
                <span>{isUrdu ? 'موجودہ کیش:' : 'Expected Cash:'} <strong className="font-bold text-slate-900">Rs. {formatRs(summary.drawer.expected_cash)}</strong></span>
              ) : (
                <span className="text-amber-700">{isUrdu ? 'شفٹ کھولنے کے لیے کاؤنٹر جائیں' : 'Open drawer at counter'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Low Stock Alert */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isUrdu ? 'کم اسٹاک الرٹ' : 'Low Stock Items'}
            </span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              summary.low_stock_count > 0
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black ${summary.low_stock_count > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {summary.low_stock_count}
              <span className="text-xs font-bold text-slate-500 ml-1.5">{isUrdu ? 'سامان' : 'Products'}</span>
            </div>
            <div className="mt-1 text-[11px] font-medium flex items-center gap-1">
              {summary.low_stock_count > 0 ? (
                <button
                  onClick={() => onNavigate && onNavigate('inventory')}
                  className="text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                >
                  {isUrdu ? 'اسٹاک چیک کریں →' : 'View low inventory →'}
                </button>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isUrdu ? 'تمام اسٹاک تسلی بخش ہے' : 'All stocks sufficient'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CHART - LAST 7 DAYS DAILY SALES (Smooth CSS grow animation, 0 heavy dependencies) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                {isUrdu ? 'پچھلے ۷ دن کی یومیہ فروخت (Daily Sales Trend)' : 'Past 7 Days Daily Sales Trend'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                {isUrdu ? 'آخری ۷ دن' : 'Last 7 Days'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isUrdu ? 'ہفتہ وار فروخت کا خلاصہ اور یومیہ آرڈرز' : 'Daily sales volume and orders count comparison'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 font-semibold block">{isUrdu ? 'ہفتہ وار مجموعی سیل' : '7-Day Total Sales'}</span>
            <span className="text-base font-black text-blue-600">Rs. {formatRs(totalWeeklySales)}</span>
          </div>
        </div>

        {/* SVG/HTML Bar Chart with Hover Tooltip */}
        <div className="relative pt-6 pb-2">
          {/* Chart Bars Grid */}
          <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-slate-200">
            {dailyTrend.map((item, idx) => {
              const heightPercent = maxSale > 0 ? Math.max((item.sales / maxSale) * 100, item.sales > 0 ? 8 : 3) : 3;
              const isHovered = hoveredDay === idx;
              const isToday = idx === 6;

              return (
                <div
                  key={item.date}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  onMouseEnter={() => setHoveredDay(idx)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Floating Hover Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[10px] py-1 px-2.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap animate-fadeIn">
                      <div className="font-bold">{item.displayDate} ({isUrdu ? item.dayUrdu : item.day})</div>
                      <div className="text-emerald-400 font-bold">Rs. {formatRs(item.sales)}</div>
                      <div className="text-slate-300">{item.orders} {isUrdu ? 'بلز' : 'orders'}</div>
                    </div>
                  )}

                  {/* Value on top of bar if sales > 0 */}
                  <span className={`text-[10px] font-bold mb-1.5 transition-opacity ${
                    item.sales > 0 ? 'text-slate-700 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                  }`}>
                    {item.sales > 0 ? `${Math.round(item.sales / 1000)}k` : '0'}
                  </span>

                  {/* Animated Bar */}
                  <div
                    style={{ height: chartLoaded ? `${heightPercent}%` : '4%' }}
                    className={`w-full max-w-[48px] rounded-t-xl transition-all duration-700 ease-out relative ${
                      isToday
                        ? 'bg-gradient-to-t from-blue-600 to-blue-400 shadow-sm shadow-blue-500/20'
                        : isHovered
                          ? 'bg-blue-500'
                          : item.sales > 0
                            ? 'bg-gradient-to-t from-slate-400 to-slate-300'
                            : 'bg-slate-100'
                    }`}
                  >
                    {/* Orders Pill inside bar */}
                    {item.orders > 0 && heightPercent > 25 && (
                      <span className="absolute bottom-1 inset-x-0 text-center text-[9px] font-extrabold text-white">
                        {item.orders}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Date & Day Labels under bars */}
          <div className="flex justify-between gap-2 sm:gap-4 px-2 mt-2.5">
            {dailyTrend.map((item, idx) => {
              const isToday = idx === 6;
              return (
                <div key={item.date} className="flex-1 text-center">
                  <span className={`block text-[11px] font-bold truncate ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>
                    {isUrdu ? item.dayUrdu : item.day}
                  </span>
                  <span className="block text-[9.5px] font-medium text-slate-400 truncate">
                    {item.displayDate}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. LOWER SECTION: TOP 5 PRODUCTS & PENDING AMOUNTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: TOP 5 PRODUCTS LIST (is hafte, quantity-wise, list format) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 tracking-tight">
                    {isUrdu ? 'اس ہفتے سب سے زیادہ فروخت ہونے والا سامان' : 'Top 5 Best Selling Items (This Week)'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isUrdu ? 'تعداد و فروخت کے لحاظ سے' : 'Ranked by units sold'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Top 5
              </span>
            </div>

            {/* List */}
            <div className="mt-3 divide-y divide-slate-100">
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Package className="w-7 h-7 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs font-semibold">{isUrdu ? 'ابھی تک کوئی فروخت ریکارڈ نہیں ہوئی' : 'No sales recorded this week'}</p>
                </div>
              ) : (
                topProducts.map((p, index) => (
                  <div key={p.product_id || index} className="py-2.5 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        index === 0 ? 'bg-amber-100 text-amber-800' :
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        #{index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">{p.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {isUrdu ? 'کل ریونیو:' : 'Revenue:'} <span className="font-semibold text-slate-600">Rs. {formatRs(p.revenue)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs">
                        {p.quantity} {isUrdu ? 'عدد' : 'pcs'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-3 flex justify-end">
            <button
              onClick={() => onNavigate && onNavigate('inventory')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <span>{isUrdu ? 'پورا اسٹاک کیٹلاگ دیکھیں' : 'View Complete Stock'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: 4. PENDING AMOUNTS (Customer Receivable & Supplier Payable) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 tracking-tight">
                    {isUrdu ? 'کھاتہ و زیر التواء واجبات (Pending Khata)' : 'Pending Receivables & Payables'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isUrdu ? 'مارکیٹ کے ادھار و بقایاجات' : 'Customer credit & supplier dues balance'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Ledger Balance
              </span>
            </div>

            {/* 2 Big Pending Amount Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {/* Customer Receivable */}
              <div
                onClick={() => onNavigate && onNavigate('ledger')}
                className="p-4 bg-gradient-to-br from-blue-50/60 to-white rounded-xl border border-blue-100 hover:border-blue-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-blue-700 mb-2">
                  <span className="text-[11px] font-bold">{isUrdu ? 'گاہکوں کا ادھار (وصول طلب)' : 'Customer Receivable'}</span>
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                  Rs. {formatRs(summary.total_receivable)}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-100/60 text-[10px] text-blue-600 font-semibold">
                  <span>{isUrdu ? 'کھاتہ دیکھیں' : 'View Ledger'}</span>
                  <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>

              {/* Supplier Payable */}
              <div
                onClick={() => onNavigate && onNavigate('ledger')}
                className="p-4 bg-gradient-to-br from-rose-50/60 to-white rounded-xl border border-rose-100 hover:border-rose-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-rose-700 mb-2">
                  <span className="text-[11px] font-bold">{isUrdu ? 'سپلائرز کے واجبات (ادائیگی)' : 'Supplier Payable'}</span>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-slate-900 tracking-tight group-hover:text-rose-600 transition-colors">
                  Rs. {formatRs(summary.total_payable)}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-100/60 text-[10px] text-rose-600 font-semibold">
                  <span>{isUrdu ? 'کھاتہ دیکھیں' : 'View Ledger'}</span>
                  <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>{isUrdu ? 'کھاتے کے تفصیلی بیانات کے لیے پارٹی کھاتہ کھولیں۔' : 'For full statement and ledgers, visit Party Ledgers.'}</span>
            <button
              onClick={() => onNavigate && onNavigate('ledger')}
              className="text-slate-800 hover:text-blue-600 font-bold ml-2 shrink-0 cursor-pointer"
            >
              {isUrdu ? 'کھاتہ کھولیں →' : 'Open Khata →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
