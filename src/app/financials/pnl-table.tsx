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

function money(n: number) {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString()}`;
}

function VarianceCell({ value }: { value: number }) {
  const rounded = Math.round(value);
  const color =
    rounded > 0
      ? "text-emerald-700"
      : rounded < 0
        ? "text-red-700"
        : "text-neutral-500";
  return <td className={`px-2.5 py-1.5 text-right tabular-nums ${color}`}>{money(value)}</td>;
}

function FiguresCells({ figures }: { figures: Figures }) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{money(figures.actual)}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-neutral-500">{money(figures.budget)}</td>
      <VarianceCell value={figures.variance} />
    </>
  );
}

function LineRow({ line }: { line: Line }) {
  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50">
      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 pl-6 text-neutral-700">
        {line.description}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums text-neutral-500">
        {money(line.annualBudget)}
      </td>
      {line.months.map((m, i) => (
        <FiguresCells key={i} figures={m} />
      ))}
      <FiguresCells figures={line.ytd} />
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
}: {
  label: string;
  total: { annualBudget?: number; months: Figures[]; ytd: Figures };
  emphasize?: boolean;
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
        {total.annualBudget !== undefined ? money(total.annualBudget) : ""}
      </td>
      {total.months.map((m, i) => (
        <FiguresRowCells key={i} figures={m} emphasize={emphasize} />
      ))}
      <FiguresRowCells figures={total.ytd} emphasize={emphasize} />
    </tr>
  );
}

function FiguresRowCells({ figures, emphasize }: { figures: Figures; emphasize?: boolean }) {
  const varColor = emphasize
    ? figures.variance > 0
      ? "text-emerald-300"
      : figures.variance < 0
        ? "text-red-300"
        : "text-neutral-300"
    : figures.variance > 0
      ? "text-emerald-700"
      : figures.variance < 0
        ? "text-red-700"
        : "text-neutral-500";
  return (
    <>
      <td className="px-2.5 py-2 text-right tabular-nums">{money(figures.actual)}</td>
      <td className={`px-2.5 py-2 text-right tabular-nums ${emphasize ? "text-neutral-300" : "text-neutral-500"}`}>
        {money(figures.budget)}
      </td>
      <td className={`px-2.5 py-2 text-right tabular-nums ${varColor}`}>{money(figures.variance)}</td>
    </>
  );
}

export default function PnlTable() {
  const colSpan = 2 + data.months.length * 3 + 3;

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-900">{data.title}</h2>
        <p className="mt-0.5 text-xs text-neutral-600">
          {data.period} &middot; Actual vs. Budget vs. Variance, by month and
          year-to-date.
        </p>
      </div>
      <div className="max-h-[70vh] overflow-auto border-t border-neutral-200">
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-neutral-100">
              <th className="sticky left-0 z-30 bg-neutral-900 px-3 py-2.5">
                Line Item
              </th>
              <th className="bg-neutral-900 px-2.5 py-2.5 text-right">
                Annual Budget
              </th>
              {data.months.map((m) => (
                <th key={m} className="bg-neutral-900 px-2.5 py-2.5 text-right" colSpan={3}>
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
                <Fragment key={m}>
                  <th className="bg-neutral-800 px-2.5 py-1 text-right">Actual</th>
                  <th className="bg-neutral-800 px-2.5 py-1 text-right">Budget</th>
                  <th className="bg-neutral-800 px-2.5 py-1 text-right">Variance</th>
                </Fragment>
              ))}
              <th className="bg-neutral-800 px-2.5 py-1 text-right">Actual</th>
              <th className="bg-neutral-800 px-2.5 py-1 text-right">Budget</th>
              <th className="bg-neutral-800 px-2.5 py-1 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {data.sections.map((section) => {
              let lastCategory = "";
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
                        <LineRow line={line} />
                      </Fragment>
                    );
                  })}
                  <TotalRow
                    label={section.totalLabel}
                    total={section.total}
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
