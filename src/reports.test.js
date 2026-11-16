import { describe, it, expect } from "vitest";
import { addExpense, createGroup, deleteExpense, recordPayment } from "./ledger.js";
import { categoryTotals, memberSummary } from "./reports.js";

function group() {
  const g = createGroup("g", "Test", [
    { id: "u1", name: "A" },
    { id: "u2", name: "B" },
  ]);
  addExpense(g, { description: "Lunch", amountMinor: 1000, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
  addExpense(g, { description: "Dinner", amountMinor: 3000, paidBy: "u2", participants: ["u1", "u2"], category: "food" });
  addExpense(g, { description: "Bus", amountMinor: 500, paidBy: "u1", participants: ["u1", "u2"], category: "travel" });
  return g;
}

describe("categoryTotals", () => {
  it("adds up spend per category, largest first", () => {
    expect(categoryTotals(group())).toEqual([
      { category: "food", totalMinor: 4000 },
      { category: "travel", totalMinor: 500 },
    ]);
  });

  it("files an expense with no category under other", () => {
    const g = createGroup("g", "Test", [{ id: "u1", name: "A" }]);
    addExpense(g, { description: "Old", amountMinor: 700, paidBy: "u1", participants: ["u1"] });
    expect(categoryTotals(g)).toEqual([{ category: "other", totalMinor: 700 }]);
  });
});

describe("memberSummary", () => {
  it("reports what each member paid and what their share came to", () => {
    const rows = memberSummary(group());
    const a = rows.find((r) => r.id === "u1");
    const b = rows.find((r) => r.id === "u2");
    expect(a).toMatchObject({ paidMinor: 1500, owedMinor: 2250 });
    expect(b).toMatchObject({ paidMinor: 3000, owedMinor: 2250 });
  });

  it("includes the balance after payments between members", () => {
    const g = group();
    recordPayment(g, { from: "u1", to: "u2", amountMinor: 500 });
    const a = memberSummary(g).find((r) => r.id === "u1");
    expect(a.balanceMinor).toBe(-750 + 500);
  });
});

describe("Spending totals after deletions", () => {
  it("[QP-QUICK-59-1] Excludes the deleted dinner entry from the Goa trip Spending total", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "b", name: "Bhavin" },
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    addExpense(g, { description: "Team dinner", amountMinor: 1200, paidBy: "b", participants: ["b", "u1", "u2", "u3"], category: "food" });
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "b", participants: ["b", "u1", "u2", "u3"], category: "food" });
    deleteExpense(g, dup.id);
    const totals = categoryTotals(g);
    const total = totals.reduce((sum, r) => sum + r.totalMinor, 0);
    expect(total).toBe(1200);
    expect(totals.find((r) => r.category === "food").totalMinor).toBe(1200);
  });

  it("[QP-QUICK-59-2] Spending total equals the sum of the amounts of the expenses in the Expenses list", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Taxi", amountMinor: 800, paidBy: "u2", participants: ["u1", "u2"], category: "travel" });
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, dup.id);
    const listed = g.expenses.filter((e) => !e.deletedAt).map((e) => e.amountMinor);
    const total = categoryTotals(g).reduce((sum, r) => sum + r.totalMinor, 0);
    expect(total).toBe(listed.reduce((sum, n) => sum + n, 0));
  });

  it("[QP-QUICK-58-1] Spending total excludes the deleted Goa dinner expense", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "b", name: "Bhavin" },
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "b", participants: ["b", "u1", "u2", "u3"], category: "food" });
    deleteExpense(g, dup.id);
    const total = categoryTotals(g).reduce((sum, r) => sum + r.totalMinor, 0);
    expect(total).toBe(0);
  });

  it("[QP-QUICK-58-2] Spending total matches the sum of non-deleted expenses", () => {
    const g = group();
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, dup.id);
    const total = categoryTotals(g).reduce((sum, r) => sum + r.totalMinor, 0);
    expect(total).toBe(4500);
  });

  it("[QP-QUICK-58-3] Deleting an expense removes it from Spending totals", () => {
    const g = createGroup("g", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    const big = addExpense(g, { description: "Hotel", amountMinor: 1200, paidBy: "u1", participants: ["u1", "u2"], category: "travel" });
    addExpense(g, { description: "Taxi", amountMinor: 800, paidBy: "u2", participants: ["u1", "u2"], category: "travel" });
    deleteExpense(g, big.id);
    const total = categoryTotals(g).reduce((sum, r) => sum + r.totalMinor, 0);
    expect(total).toBe(800);
    expect(g.expenses.map((e) => e.amountMinor)).toContain(800);
  });

  it("[QP-QUICK-60-1] Spending excludes the seeded deleted expense on the Goa trip", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "b", name: "Bhavin" },
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "b", participants: ["b", "u1", "u2", "u3"], category: "food" });
    deleteExpense(g, dup.id);
    const food = categoryTotals(g).find((r) => r.category === "food");
    expect(food?.totalMinor ?? 0).not.toBe(4860);
  });

  it("[QP-QUICK-60-2] Spending totals match Balances and Expenses list when a deleted expense exists", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
    ]);
    addExpense(g, { description: "Taxi", amountMinor: 800, paidBy: "u2", participants: ["u1", "u2"], category: "travel" });
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "u1", participants: ["u1", "u2"], category: "food" });
    deleteExpense(g, dup.id);
    const listed = g.expenses.filter((e) => !e.deletedAt).map((e) => e.amountMinor);
    const total = categoryTotals(g).reduce((sum, r) => sum + r.totalMinor, 0);
    expect(total).toBe(listed.reduce((sum, n) => sum + n, 0));
  });

  it("[QP-QUICK-60-3] Restored expense is counted again in Spending", () => {
    const g = createGroup("goa", "Goa trip", [
      { id: "b", name: "Bhavin" },
      { id: "u1", name: "A" },
      { id: "u2", name: "B" },
      { id: "u3", name: "C" },
    ]);
    const dup = addExpense(g, { description: "Duplicate dinner entry", amountMinor: 4860, paidBy: "b", participants: ["b", "u1", "u2", "u3"], category: "food" });
    deleteExpense(g, dup.id);
    delete dup.deletedAt;
    const food = categoryTotals(g).find((r) => r.category === "food");
    expect(food.totalMinor).toBe(4860);
  });
});
