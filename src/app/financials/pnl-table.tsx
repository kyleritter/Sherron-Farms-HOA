import { Fragment } from "react";
import pnlData from "@/data/pnl-2026.json";

type Figures = { actual: number; budget: number; variance: number };
type Line = {
  category: string;
  acctCode: string;
  description: string;
  annualBudget: number;
  months: Figures[];
  ytd: Figures;
};
type Section = {
  name: string;
  lines: Line[];
  total: { annualBudget: number; months: Figures[]; ytd: Figures };
  totalLabel: string;
};

const data = pnlData as {
  title: string;
  period: string;
  months: string[];
  sections: Section[];
  netIncome: { months: Figures[]; ytd: Figures };
};

// Accounting-style formatting: negative numbers always render in
// parentheses instead of with a minus sign. `forceParens` additionally
// wraps a non-negative amount in parentheses -- used for expense-section
// actual/budget figures, which represent money going out even though
// they're stored as positive numbers.
function money(n: number, forceParens = false) {
  const rounded = Math.round(n);
  const formatted = `$${Math.abs(rounded).toLocaleString()}`;
  return rounded < 0 || (forceParens && rounded > 0)
    ? `(${formatted})`
    : formatted;
}

// `displayVariance` is already sign-adjusted for the section it belongs
// to (see displayVarianceFor below): negative = overspend/shortfall
// (bad -- red, parenthesized), zero or positive = on/under budget
// (good -- green).
function varianceColor(displayVariance: number, emphasize?: boolean) {
  const rounded = Math.round(displayVariance);
  if (emphasize) {
    return rounded < 0 ? "text-red-300" : "text-emerald-300";
  }
  return rounded < 0 ? "text-red-700" : "text-emerald-700";
}

// Variance is stored as (actual - budget) for every line. For expenses
// that's backwards from how "good" and "bad" should read: spending MORE
// than budgeted (actual > budget) is an overspend and should show as
// negative/red, while spending less (actual < budget) is good and
// should show as positive/green -- the opposite of the raw number's
// sign. Income keeps the raw (actual - budget) sign, where more
// revenue than budgeted is already positive/good.
function displayVarianceFor(variance: number, isExpense: boolean) {
  return isExpense ? -variance : variance;
}

function YtdCells({
  ytd,
  emphasize,
  isExpense,
}: {
  ytd: Figures;
  emphasize?: boolean;
  isExpense: boolean;
}) {
  const displayVariance = displayVarianceFor(ytd.variance, isExpense);
  return (
    <>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{money(ytd.actual, isExpense)}</td>
      <td
        className={`px-2.5 py-1.5 text-right tabular-nums ${
          emphasize ? "text-neutral-300" : "text-neutral-500"
        }`}
      >
        {money(ytd.budget, isExpense)}
      </td>
      <td className={`px-2.5 py-1.5 text-right tabular-nums ${varianceColor(displayVariance, emphasize)}`}>
        {money(displayVariance)}
      </td>
    </>
  );
}

function LineRow({ line, isExpense }: { line: Line; isExpense: boolean }) {
  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50">
      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 pl-6 text-neutral-700">
        {line.description}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-neutral-500">
        {money(line.annualBudget, isExpense)}
      </td>
      {line.months.map((m, i) => (
        <td key={i} className="px-2.5 py-1.5 text-right tabular-nums">
          {money(m.actual, isExpense)}
        </td>
      ))}
      <YtdCells ytd={line.ytd} isExpense={isExpense} />
    </tr>
  );
}

function CategoryHeaderRow({ category, colSpan }: { category: string; colSpan: number }) {
  return (
    <tr className="border-t border-neutral-200 bg-neutral-50">
      <td
        className="sticky left-0 z-10 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-500"
        colSpan={colSpan}
      >
        {category}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  total,
  emphasize,
  isExpense = false,
}: {
  label: string;
  total: { annualBudget?: number; months: Figures[]; ytd: Figures };
  emphasize?: boolean;
  isExpense?: boolean;
}) {
  return (
    <tr
      className={`border-t-2 border-neutral-300 font-semibold ${
        emphasize ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900"
      }`}
    >
      <td
        className={`sticky left-0 z-10 px-3 py-2 ${
          emphasize ? "bg-neutral-900 text-white" : "bg-neutral-100"
        }`}
      >
        {label}
      </td>
      <td className="px-2.5 py-2 text-right tabular-nums">
        {total.annualBudget !== undefined ? money(total.annualBudget, isExpense) : ""}
      </td>
      {total.months.map((m, i) => (
        <td key={i} className="px-2.5 py-2 text-right tabular-nums">
          {money(m.actual, isExpense)}
        </td>
      ))}
      <YtdCells ytd={total.ytd} emphasize={emphasize} isExpense={isExpense} />
    </tr>
  );
}

export default function PnlTable() {
  const colSpan = 2 + data.months.length + 3;

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-900">{data.title}</h2>
        <p className="mt-0.5 text-xs text-neutral-600">
          {data.period} &middot; Annual budget, monthly actuals, and
          year-to-date actual vs. budget vs. variance.
        </p>
      </div>
      <div className="max-h-[70vh] overflow-auto border-t border-neutral-200">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-neutral-100">
              <th className="sticky left-0 z-30 bg-neutral-900 px-3 py-2.5">
                Line Item
              </th>
              <th className="bg-neutral-900 px-2.5 py-2.5 text-right">
                Annual Budget
              </th>
              {data.months.map((m) => (
                <th key={m} className="bg-neutral-900 px-2.5 py-2.5 text-right">
                  {m}
                </th>
              ))}
              <th className="bg-neutral-900 px-2.5 py-2.5 text-right" colSpan={3}>
                YTD Through {data.months[data.months.length - 1]}
              </th>
            </tr>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-300">
              <th className="sticky left-0 z-30 bg-neutral-800 px-3 py-1"></th>
              <th className="bg-neutral-800 px-2.5 py-1"></th>
              {data.months.map((m) => (
                <th key={m} className="bg-neutral-800 px-2.5 py-1 text-right">
                  Actual
                </th>
              ))}
              <th className="bg-neutral-800 px-2.5 py-1 text-right">Actual</th>
              <th className="bg-neutral-800 px-2.5 py-1 text-right">Budget</th>
              <th className="bg-neutral-800 px-2.5 py-1 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {data.sections.map((section) => {
              let lastCategory = "";
              // Expense sections' actual/budget figures are stored as
              // positive outflow amounts and their variance is flipped
              // for display (see displayVarianceFor) -- everything
              // else (income) uses the numbers as stored.
              const isExpense = section.name.toUpperCase().includes("EXPENSE");
              return (
                <Fragment key={section.name}>
                  <tr className="border-t-2 border-neutral-300">
                    <td
                      className="sticky left-0 z-10 bg-neutral-200 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-neutral-800"
                      colSpan={colSpan}
                    >
                      {section.name}
                    </td>
                  </tr>
                  {section.lines.map((line, i) => {
                    const showHeader = line.category !== lastCategory;
                    lastCategory = line.category;
                    return (
                      <Fragment key={`${section.name}-${i}`}>
                        {showHeader && (
                          <CategoryHeaderRow
                            category={line.category}
                            colSpan={colSpan}
                          />
                        )}
                        <LineRow line={line} isExpense={isExpense} />
                      </Fragment>
                    );
                  })}
                  <TotalRow
                    label={section.totalLabel}
                    total={section.total}
                    isExpense={isExpense}
                  />
                </Fragment>
              );
            })}
            <TotalRow label="NET INCOME" total={data.netIncome} emphasize />
          </tbody>
        </table>
      </div>
    </section>
  );
}
