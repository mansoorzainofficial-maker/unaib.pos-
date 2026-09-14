# Unaib Computer Accessories - POS & Management Desktop System

A complete, production-ready desktop Point of Sale (POS), Inventory, Component Warranty Tracking, and Financial Management application built for **Unaib Computer Accessories**.

---

## 🏛️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Electron.js Desktop Shell                   │
│                                                             │
│  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │     React 18 + Vite       │  │    Node.js / Express   │  │
│  │    (Tailwind CSS UI)      │  │     Local REST API     │  │
│  │  - Barcode Scanner Hook   │  │  - Auth & RBAC         │  │
│  │  - 58mm/80mm Thermal Print│◄─┼─►- Inventory Service   │  │
│  │  - Cash Drawer Session    │  │  - Sales & Invoicing   │  │
│  │  - Warranty Tracking UI   │  │  - Serial Tracker      │  │
│  │  - Financial Dashboard    │  │  - Finance & Drawer    │  │
│  └───────────────────────────┘  └───────────┬────────────┘  │
│                                             │               │
│                                             ▼               │
│                                  ┌────────────────────┐     │
│                                  │  SQLite Database   │     │
│                                  │  (WAL Mode / ACID) │     │
│                                  │ + MySQL DDL export │     │
│                                  └────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

- **Desktop Container**: Electron.js (IPC bridge, native thermal printer communication, window controls).
- **Frontend**: React 18 + Vite + Tailwind CSS + Lucide Icons + Print CSS (`@media print`).
- **Backend API**: Embedded Node.js / Express REST API running locally on port `5001`.
- **Database Engine**: Embedded SQLite database (`DatabaseSync` / WAL mode) with zero configuration required. Also includes a 100% compatible MySQL DDL schema (`mysql-schema.sql`) for multi-terminal or networked server setups.

---

## 🚀 Core Functional Modules

### 1. Inventory & Stock Management
- **Full CRUD Operations**: Create, Read, Update, and Delete accessories and computer components.
- **Fields Tracked**: Item Name, Category, Cost Price (Wholesale), Sale Price (Retail), Stock Quantity, Low Stock Alert Threshold, Supplier Details, Barcode / SKU, Warranty Duration (months), Serial Number Tracking Flag (`has_serials`).
- **Low Stock Warnings**: Real-time dashboard warnings and table filters for items below their minimum threshold.
- **Access Control**: Cost prices and deletion controls are hidden from Cashiers.

### 2. POS & Walk-in Customer Invoicing
- **High-Speed Barcode Billing**: Automatic barcode scanner input listener with audio beep feedback and `F2` focus shortcut.
- **Walk-in Customer Support**: Name and phone entry with automatic customer record generation and lifetime purchase tracking.
- **Instant Calculations**: Subtotal, Item-level or Total Discount (Amount / %), Tax Rate, Grand Total, and Cash Tender / Change Return calculator.
- **Component Serial Picker**: Prompts for required serial numbers when selling serialized hardware (SSDs, GPUs, RAM, etc.).
- **Thermal Receipt Output**: Generates compliant 58mm and 80mm thermal receipt formats with shop branding, itemized table, serial numbers, warranty terms, and barcodes.

### 3. Warranty & Serial Number Tracking
- **Individual Serial Tracking**: Track component serial numbers linked directly to specific invoice numbers and customer records.
- **Instant Serial Lookup**: Scan or type a serial number to see: Product Name, Customer Details, Purchase Date, and Warranty Expiration status (e.g. *Active: 184 days remaining* or *Expired*).
- **RMA Warranty Claims**: Log customer-reported hardware defects and track claim lifecycle (`Pending`, `Sent to Vendor`, `Repaired`, `Replaced`, `Rejected`).

### 4. Financial Reports & Cash Drawer
- **Profit & Loss Calculations**:
  - **Revenue**: Total completed sales.
  - **Cost of Goods Sold (COGS)**: Exact inventory cost preserved at the moment of sale.
  - **Gross Profit**: `Revenue - COGS`.
  - **Operating Expenses**: Rent, electricity, refreshments, staff salaries, packaging.
  - **Net Profit**: `Gross Profit - Expenses` with calculated Net Margin %.
- **Cash Drawer Shift Reconciliation**:
  - Open shift with starting cash float.
  - Live tracking of Cash Inflow (sales) and Cash Outflow (expenses).
  - Shift closing: Enter physical counted cash to calculate discrepancy (`Exact Match`, `Cash Over`, `Cash Short`).

### 5. Role-Based User Access Control (RBAC)
- **Roles**:
  - `admin`: Full access to inventory edits, cost prices, profit & loss reports, expense deletions, and staff management.
  - `cashier`: Restricted strictly to POS billing, customer entry, warranty lookup, and shift drawer operations.
- **Fast Login**: Supports standard username/password or quick 4-digit PIN pad.

---

## 🔑 Default Credentials

| Role | Username | Password | Quick PIN | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | **`1234`** | Full System & Financial Access |
| **Cashier** | `cashier1` | `cashier123` | **`1111`** | POS Billing & Customer Search Only |

---

## 📦 How to Run and Package

### 1. Prerequisites
- Node.js (v18, v20, v22, or v24) and npm installed.

### 2. Development Mode
Run the backend API, Vite frontend, and Electron container concurrently:
```bash
# In the unaib-pos-desktop folder:
npm run dev
# Or double-click: dev-app.bat
```

To run just the web interface (accessible from any browser or tablet on the local WiFi network):
```bash
npm run dev:web
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001`

### 3. Production Desktop Run
Compile the React frontend into static assets and run via Electron:
```bash
npm run build
npm start
# Or double-click: run-app.bat
```

### 4. Packaging as a Windows Desktop Executable (.exe)
To package the app into a standalone Windows installer or portable `.exe`:
```bash
# Generates Windows installer (.exe) in the release/ folder:
npm run dist:win

# Or generate portable unpacked directory:
npm run pack:win
```
The installer will be generated under `release/Unaib Computer Accessories POS-Setup-1.0.0.exe`.

---

## 🗄️ Database Architect Guide (SQLite & MySQL)

### Default: SQLite Engine
- Database File: `unaib_pos.sqlite` (created automatically in the application folder).
- Configured with `PRAGMA journal_mode = WAL;` and `PRAGMA synchronous = NORMAL;` for high-speed concurrent ACID operations.

### Multi-Counter Networked Setup: MySQL / MariaDB
If you want to run multiple counter terminals connected to a central MySQL database server:
1. Import the schema script located at:
   `backend/src/db/mysql-schema.sql`
2. Configure your MySQL credentials in an environment file or update `backend/src/config/db.js` to connect via `mysql2`.
