"""
Reads the 'YTD Data (Source)' sheet of the HOA's Monthly P&L Google
Sheet (synced locally as Sherron_Farms_HOA_Monthly_PnL.xlsx in the
Drive "Budget" folder) and computes the same derived Actual/Budget/
Variance figures the sheet's 'Monthly P&L' tab shows -- replicating its
formulas in Python since the raw .xlsx export doesn't carry cached
formula results. Writes src/data/pnl-2026.json, consumed by the
Financials page.

Re-run this whenever the source Google Sheet is updated with a new
month's actuals:
    python scripts/compute_pnl_data.py

Usage: python scripts/compute_pnl_data.py
"""
import json
import os
import openpyxl

SRC_DIR = os.path.expanduser(os.environ.get("HOME") + "/mnt/HOA/Budget")
SRC_FILE = os.path.join(SRC_DIR, "Sherron_Farms_HOA_Monthly_PnL.xlsx")
OUT_FILE = "src/data/pnl-2026.json"

MONTHS = ["January", "February", "March", "April", "May", "June", "July"]

wb = openpyxl.load_workbook(SRC_FILE, data_only=True)
ws = wb["YTD Data (Source)"]

def row_vals(r):
    return [ws.cell(row=r, column=c).value for c in range(1, 12)]  # A..K

INCOME_ROWS = list(range(7, 13))
EXPENSE_ROWS = list(range(15, 54))

def build_line(r):
    vals = row_vals(r)
    category, acct, desc, annual = vals[0], vals[1], vals[2], vals[3] or 0
    ytd_source = [vals[4 + i] or 0 for i in range(7)]
    months_out = []
    prev = 0
    for i in range(7):
        actual = ytd_source[i] - prev
        budget = annual / 12
        variance = actual - budget
        months_out.append({"actual": round(actual, 2), "budget": round(budget, 2), "variance": round(variance, 2)})
        prev = ytd_source[i]
    ytd_actual = ytd_source[6]
    ytd_budget = (annual / 12) * 7
    ytd = {"actual": round(ytd_actual, 2), "budget": round(ytd_budget, 2), "variance": round(ytd_actual - ytd_budget, 2)}
    return {"category": category, "acctCode": acct, "description": desc, "annualBudget": round(annual, 2), "months": months_out, "ytd": ytd}

def sum_section(lines):
    months_out = []
    for i in range(7):
        a = sum(l["months"][i]["actual"] for l in lines)
        b = sum(l["months"][i]["budget"] for l in lines)
        months_out.append({"actual": round(a, 2), "budget": round(b, 2), "variance": round(a - b, 2)})
    ytd_a = sum(l["ytd"]["actual"] for l in lines)
    ytd_b = sum(l["ytd"]["budget"] for l in lines)
    annual = sum(l["annualBudget"] for l in lines)
    return {"annualBudget": round(annual, 2), "months": months_out, "ytd": {"actual": round(ytd_a, 2), "budget": round(ytd_b, 2), "variance": round(ytd_a - ytd_b, 2)}}

def sub(a, b):
    months_out = []
    for i in range(7):
        actual = a["months"][i]["actual"] - b["months"][i]["actual"]
        budget = a["months"][i]["budget"] - b["months"][i]["budget"]
        months_out.append({"actual": round(actual, 2), "budget": round(budget, 2), "variance": round(actual - budget, 2)})
    ytd_a = a["ytd"]["actual"] - b["ytd"]["actual"]
    ytd_b = a["ytd"]["budget"] - b["ytd"]["budget"]
    return {"months": months_out, "ytd": {"actual": round(ytd_a, 2), "budget": round(ytd_b, 2), "variance": round(ytd_a - ytd_b, 2)}}

income_lines = [build_line(r) for r in INCOME_ROWS]
expense_lines = [build_line(r) for r in EXPENSE_ROWS]
income_total = sum_section(income_lines)
expense_total = sum_section(expense_lines)
net_income = sub(income_total, expense_total)

out = {
    "title": "Sherron Farms Homeowners Association, Inc. - Monthly Profit & Loss",
    "period": "January - July 2026",
    "months": MONTHS,
    "sections": [
        {"name": "OPERATING INCOME", "lines": income_lines, "total": income_total, "totalLabel": "Total OPERATING INCOME"},
        {"name": "OPERATING EXPENSE", "lines": expense_lines, "total": expense_total, "totalLabel": "Total OPERATING EXPENSE"},
    ],
    "netIncome": net_income,
}

with open(OUT_FILE, "w") as f:
    json.dump(out, f, indent=2)

print(f"Wrote {OUT_FILE} ({os.path.getsize(OUT_FILE)} bytes)")
print("Net income YTD:", net_income["ytd"])
