# OmniKey AI — Model Catalog Diagnosis & Audit Tool

This folder contains a standalone utility for conducting automated, multi-database model catalog audits. It reconciles the state of all 106 models between your local SQLite database and your cloud MongoDB cluster, verifying overall routing availability for the active user.

---

## 🚀 How to Run the Diagnosis

To run the audit tool and generate reports in CSV, JSON, and Excel format, execute the following commands in your terminal:

```bash
# 1. Navigate to the models directory
cd models

# 2. Install dependencies (better-sqlite3, mongoose, dotenv, xlsx)
npm install

# 3. Execute the diagnosis tool
node diagnosis.js
```

---

## 📊 Report Structure

The tool outputs a formatted table directly to the console and generates three report files inside the `/models` directory:
- `models_report.json`
- `models_report.csv`
- `models_report.xlsx`

Each report contains the following columns:

| Column | Description | Supported Values |
| :--- | :--- | :--- |
| **model** | The unique catalog identifier of the model. | *e.g., `google/gemini-2.5-flash`, `nvidia/google/gemma-4-31b-it`* |
| **local db** | The global enablement state of the model in the SQLite master. | `enabled` / `disabled` |
| **cloud db** | The global enablement state of the model in the MongoDB replica. | `enabled` / `disabled` |
| **result** | The actual routing availability status for the active user. | `Available` (Enabled + active key configured)<br>`No Api` (Enabled but missing provider key)<br>`Disabled` (Disabled system-wide)<br>`Available (Local Only)` (Local key present, cloud key missing)<br>`Available (Cloud Only)` (Cloud key present, local key missing) |

---

## ⚙️ How it Works
1. **Dynamic Environment Resolution:** The script reads parent-level `.env` values to connect to the correct MongoDB cluster.
2. **Dynamic User Key Lookup:** It automatically queries MongoDB's `usersettings` collection to resolve your primary user ID, running the active API key health check contextually for your actual keys.
3. **Multi-Format Exporting:** Standard JS file writes handle CSV/JSON, while the standard **SheetJS (`xlsx`)** engine generates a fully-indexed binary Excel workbook.
