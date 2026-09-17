const { query, get } = require('../config/db');

/**
 * Get Financial Dashboard Overview (Today, Week, Month, All-Time, or Custom Range)
 * Admin only!
 */
async function getFinancialSummary(req, res) {
  try {
    const { period = 'today', start_date, end_date } = req.query;

    let dateFilter = '';
    let params = [];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (period === 'today') {
      dateFilter = `DATE(created_at) = DATE(?)`;
      params = [todayStr];
    } else if (period === 'this_month') {
      const monthStart = `${todayStr.slice(0, 7)}-01`;
      dateFilter = `DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)`;
      params = [monthStart, todayStr];
    } else if (period === 'custom' && start_date && end_date) {
      dateFilter = `DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)`;
      params = [start_date, end_date];
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dateFilter = `DATE(created_at) >= DATE(?)`;
      params = [thirtyDaysAgo];
    }

    // 1. Total Revenue, Invoice Count, Discounts Given, Tax Collected
    const salesStats = await get(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COALESCE(SUM(grand_total), 0) as total_revenue
      FROM invoices
      WHERE status = 'completed' AND ${dateFilter}
    `, params);

    // 2. Cost of Goods Sold (COGS) for completed sales
    let cogsDateFilter = dateFilter.replace(/created_at/g, 'inv.created_at');
    const cogsStats = await get(`
      SELECT
        COALESCE(SUM(ii.cost_price * ii.quantity), 0) as total_cogs
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status = 'completed' AND ${cogsDateFilter}
    `, params);

    // 3. Operating Expenses in the same period
    let expenseDateFilter = dateFilter.replace(/created_at/g, 'expense_date');
    const expenseStats = await get(`
      SELECT
        COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE ${expenseDateFilter}
    `, params);

    // 4. Payment Methods Breakdown
    const paymentBreakdown = await query(`
      SELECT
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(grand_total), 0) as total
      FROM invoices
      WHERE status = 'completed' AND ${dateFilter}
      GROUP BY payment_method
    `, params);

    // 5. Calculate Gross Profit & Net Profit
    const revenue = Number(salesStats?.total_revenue) || 0;
    const cogs = Number(cogsStats?.total_cogs) || 0;
    const grossProfit = revenue - cogs;
    const expenses = Number(expenseStats?.total_expenses) || 0;
    const netProfit = grossProfit - expenses;
    const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0;

    // 6. Top Selling Accessories in Period
    const topProducts = await query(`
      SELECT
        ii.product_name,
        SUM(ii.quantity) as total_qty_sold,
        SUM(ii.total_price) as total_revenue,
        SUM(ii.total_price - (ii.cost_price * ii.quantity)) as total_profit
      FROM invoice_items ii
      JOIN invoices inv ON ii.invoice_id = inv.id
      WHERE inv.status = 'completed' AND ${cogsDateFilter}
      GROUP BY ii.product_id, ii.product_name
      ORDER BY total_qty_sold DESC
      LIMIT 5
    `, params);

    // 7. Recent Daily Sales Trend (for chart)
    const dailyTrend = await query(`
      SELECT
        DATE(created_at) as sale_date,
        COUNT(*) as order_count,
        COALESCE(SUM(grand_total), 0) as daily_revenue
      FROM invoices
      WHERE status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT 14
    `);

    return res.json({
      success: true,
      period,
      summary: {
        total_invoices: Number(salesStats?.total_invoices) || 0,
        total_revenue: revenue,
        total_cogs: cogs,
        gross_profit: grossProfit,
        total_expenses: expenses,
        net_profit: netProfit,
        profit_margin: Number(profitMargin),
        total_discount: Number(salesStats?.total_discount) || 0,
        total_tax: Number(salesStats?.total_tax) || 0
      },
      payment_breakdown: paymentBreakdown,
      top_products: topProducts,
      daily_trend: dailyTrend.reverse()
    });
  } catch (error) {
    console.error('getFinancialSummary error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Comprehensive Tax Audit & Ledger Report (Output Tax vs Input Tax)
 * Filterable by: today, this_month, last_30_days, custom date range
 */
async function getTaxReport(req, res) {
  try {
    const { period = 'this_month', start_date, end_date } = req.query;

    let invDateFilter = '';
    let purDateFilter = '';
    let params = [];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (period === 'today') {
      invDateFilter = `DATE(inv.created_at) = DATE(?)`;
      purDateFilter = `DATE(p.purchase_date) = DATE(?)`;
      params = [todayStr];
    } else if (period === 'this_month') {
      const monthStart = `${todayStr.slice(0, 7)}-01`;
      invDateFilter = `DATE(inv.created_at) >= DATE(?) AND DATE(inv.created_at) <= DATE(?)`;
      purDateFilter = `DATE(p.purchase_date) >= DATE(?) AND DATE(p.purchase_date) <= DATE(?)`;
      params = [monthStart, todayStr];
    } else if (period === 'custom' && start_date && end_date) {
      invDateFilter = `DATE(inv.created_at) >= DATE(?) AND DATE(inv.created_at) <= DATE(?)`;
      purDateFilter = `DATE(p.purchase_date) >= DATE(?) AND DATE(p.purchase_date) <= DATE(?)`;
      params = [start_date, end_date];
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      invDateFilter = `DATE(inv.created_at) >= DATE(?)`;
      purDateFilter = `DATE(p.purchase_date) >= DATE(?)`;
      params = [thirtyDaysAgo];
    }

    // 1. Output Tax Summary (Sales Tax collected from Customers)
    const salesTaxSummary = await get(`
      SELECT
        COUNT(*) as total_tax_invoices,
        COALESCE(SUM(inv.subtotal - inv.discount_amount), 0) as total_taxable_sales,
        COALESCE(SUM(inv.tax_amount), 0) as total_output_tax,
        COALESCE(SUM(inv.grand_total), 0) as total_sales_with_tax
      FROM invoices inv
      WHERE inv.status = 'completed' AND inv.tax_amount > 0 AND ${invDateFilter}
    `, params);

    // 2. Input Tax Summary (Purchase Tax paid to Suppliers)
    const purchaseTaxSummary = await get(`
      SELECT
        COUNT(*) as total_tax_purchases,
        COALESCE(SUM(p.subtotal - p.discount), 0) as total_taxable_purchases,
        COALESCE(SUM(p.tax_amount), 0) as total_input_tax,
        COALESCE(SUM(p.grand_total), 0) as total_purchases_with_tax
      FROM purchases p
      WHERE p.tax_amount > 0 AND ${purDateFilter}
    `, params);

    // 3. Detailed Invoices with Tax
    const salesTaxInvoices = await query(`
      SELECT
        inv.id,
        inv.invoice_number,
        inv.customer_id,
        inv.customer_name,
        inv.created_at,
        inv.subtotal,
        inv.discount_amount,
        (inv.subtotal - inv.discount_amount) as taxable_amount,
        inv.tax_rate,
        inv.tax_amount,
        inv.grand_total,
        inv.payment_method
      FROM invoices inv
      WHERE inv.status = 'completed' AND inv.tax_amount > 0 AND ${invDateFilter}
      ORDER BY inv.id DESC
      LIMIT 100
    `, params);

    // 4. Detailed Purchases with Tax
    const purchaseTaxBills = await query(`
      SELECT
        p.id,
        p.purchase_number,
        p.supplier_invoice_no,
        p.supplier_id,
        s.name as supplier_name,
        p.purchase_date,
        p.subtotal,
        p.discount,
        (p.subtotal - p.discount) as taxable_amount,
        p.tax_rate,
        p.tax_amount,
        p.grand_total,
        p.payment_method
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.tax_amount > 0 AND ${purDateFilter}
      ORDER BY p.id DESC
      LIMIT 100
    `, params);

    const outputTax = Number(salesTaxSummary?.total_output_tax) || 0;
    const inputTax = Number(purchaseTaxSummary?.total_input_tax) || 0;
    const netTaxPayable = Math.round((outputTax - inputTax) * 100) / 100;

    return res.json({
      success: true,
      period,
      summary: {
        total_output_tax: outputTax,
        total_input_tax: inputTax,
        net_tax_payable: netTaxPayable,
        is_credit: netTaxPayable < 0,
        total_taxable_sales: Number(salesTaxSummary?.total_taxable_sales) || 0,
        total_tax_invoices: Number(salesTaxSummary?.total_tax_invoices) || 0,
        total_taxable_purchases: Number(purchaseTaxSummary?.total_taxable_purchases) || 0,
        total_tax_purchases: Number(purchaseTaxSummary?.total_tax_purchases) || 0
      },
      sales_tax_invoices: salesTaxInvoices,
      purchase_tax_bills: purchaseTaxBills
    });
  } catch (error) {
    console.error('getTaxReport error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getFinancialSummary,
  getTaxReport
};
