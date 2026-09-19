const { query, get } = require('../config/db');

/**
 * Get Comprehensive Dashboard Overview in a single lightweight API call
 * Aggregates Today's Sales, Invoices, Cash Drawer, Low Stock, 7-Day Trend, Top Products, and Pending Khata
 */
async function getDashboardOverview(req, res) {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgoDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().slice(0, 10);

    // 1. Today's Total Sales & Invoices Count
    const todayStatsPromise = get(`
      SELECT
        COUNT(*) as today_invoices,
        COALESCE(SUM(grand_total), 0) as today_sales
      FROM invoices
      WHERE status = 'completed' AND DATE(created_at) = DATE(?)
    `, [todayStr]);

    // 2. Cash Drawer Status (Active Shift)
    const drawerPromise = get(`
      SELECT
        id,
        cashier_id,
        status,
        opening_cash,
        cash_sales,
        cash_expenses,
        expected_closing_cash,
        opened_at
      FROM cash_drawers
      WHERE status = 'open'
      ORDER BY id DESC LIMIT 1
    `);

    // 3. Low Stock Alert Count (Products at or below threshold)
    const lowStockPromise = get(`
      SELECT COUNT(*) as low_stock_count
      FROM products
      WHERE stock_quantity <= low_stock_threshold
    `);

    // 4. Last 7 Days Daily Sales (from 6 days ago to today)
    const dailyTrendPromise = query(`
      SELECT
        DATE(created_at) as sale_date,
        COUNT(*) as order_count,
        COALESCE(SUM(grand_total), 0) as daily_revenue
      FROM invoices
      WHERE status = 'completed' AND DATE(created_at) >= DATE(?)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [sevenDaysAgoStr]);

    // 5. Top 5 Products Sold This Week (Quantity-wise)
    const topProductsPromise = query(`
      SELECT
        ii.product_id,
        ii.product_name,
        SUM(ii.quantity) as total_qty,
        SUM(ii.total_price) as total_revenue
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status = 'completed' AND DATE(inv.created_at) >= DATE(?)
      GROUP BY ii.product_id, ii.product_name
      ORDER BY total_qty DESC
      LIMIT 5
    `, [sevenDaysAgoStr]);

    // 6. Pending Amounts (Customer Khata / Receivables & Supplier Payables)
    const customerKhataPromise = get(`
      SELECT COALESCE(SUM(current_balance), 0) as total_receivable
      FROM customers
      WHERE current_balance > 0
    `);

    const supplierPayablePromise = get(`
      SELECT COALESCE(SUM(current_balance), 0) as total_payable
      FROM suppliers
      WHERE current_balance > 0
    `);

    // Execute all parallel queries concurrently in ~15ms
    const [
      todayStats,
      drawer,
      lowStock,
      dailyTrendRows,
      topProducts,
      customerKhata,
      supplierPayable
    ] = await Promise.all([
      todayStatsPromise,
      drawerPromise,
      lowStockPromise,
      dailyTrendPromise,
      topProductsPromise,
      customerKhataPromise,
      supplierPayablePromise
    ]);

    // Build guaranteed 7-day calendar trend (even if 0 sales on some days)
    const trendMap = {};
    (dailyTrendRows || []).forEach(r => {
      // Normalise date string to YYYY-MM-DD
      const d = String(r.sale_date).slice(0, 10);
      trendMap[d] = {
        orders: Number(r.order_count) || 0,
        sales: Math.round(Number(r.daily_revenue) || 0)
      };
    });

    const full7DaysTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const urduDayNames = {
        'Sun': 'اتوار',
        'Mon': 'پیر',
        'Tue': 'منگل',
        'Wed': 'بدھ',
        'Thu': 'جمعرات',
        'Fri': 'جمعہ',
        'Sat': 'ہفتہ'
      };

      const dayData = trendMap[dateStr] || { orders: 0, sales: 0 };
      full7DaysTrend.push({
        date: dateStr,
        day: dayName,
        dayUrdu: urduDayNames[dayName] || dayName,
        displayDate: `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
        orders: dayData.orders,
        sales: dayData.sales
      });
    }

    // Format final aggregated response
    return res.json({
      success: true,
      data: {
        summary: {
          today_sales: Math.round(Number(todayStats?.today_sales) || 0),
          today_invoices: Number(todayStats?.today_invoices) || 0,
          drawer: {
            isOpen: Boolean(drawer && drawer.status === 'open'),
            expected_cash: Math.round(Number(drawer?.expected_closing_cash || drawer?.opening_cash || 0)),
            opening_cash: Math.round(Number(drawer?.opening_cash) || 0),
            cash_sales: Math.round(Number(drawer?.cash_sales) || 0),
            opened_at: drawer?.opened_at || null
          },
          low_stock_count: Number(lowStock?.low_stock_count) || 0,
          total_receivable: Math.round(Number(customerKhata?.total_receivable) || 0),
          total_payable: Math.round(Number(supplierPayable?.total_payable) || 0)
        },
        daily_trend: full7DaysTrend,
        top_products: (topProducts || []).map(p => ({
          product_id: p.product_id,
          name: p.product_name,
          quantity: Number(p.total_qty) || 0,
          revenue: Math.round(Number(p.total_revenue) || 0)
        }))
      }
    });
  } catch (error) {
    console.error('getDashboardOverview Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load dashboard overview: ' + error.message
    });
  }
}

module.exports = {
  getDashboardOverview
};
