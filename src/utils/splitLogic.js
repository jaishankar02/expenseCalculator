/**
 * Calculates net balance for each person and returns a simplified list of debts.
 * @param {Array} people - Array of person objects { id, name }
 * @param {Array} expenses - Array of expense objects { id, description, amount, payerId, beneficiaryIds }
 */
export const calculateBalances = (people, expenses) => {
  const balances = {};
  people.forEach(p => balances[p.id] = 0);

  expenses.forEach(exp => {
    const amountPerPerson = exp.amount / exp.beneficiaryIds.length;
    
    // Payer is out of pocket the full amount
    balances[exp.payerId] += exp.amount;

    // Each beneficiary owes their share
    exp.beneficiaryIds.forEach(bId => {
      balances[bId] -= amountPerPerson;
    });
  });

  return balances;
};

/**
 * Simplifies debts to find who owes whom the minimum number of transactions.
 * Uses a greedy approach: identify largest creditor and largest debtor.
 */
export const simplifyDebts = (balances, people) => {
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([id, balance]) => {
    const name = people.find(p => p.id === id)?.name || 'Unknown';
    if (balance < -0.01) {
      debtors.push({ id, name, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ id, name, amount: balance });
    }
  });

  // Sort by amount descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settlementAmount = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      fromId: debtor.id,
      from: debtor.name,
      toId: creditor.id,
      to: creditor.name,
      amount: settlementAmount
    });

    debtor.amount -= settlementAmount;
    creditor.amount -= settlementAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return transactions;
};
