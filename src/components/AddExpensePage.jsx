import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthPage from './AuthPage';
import { API_BASE } from '../config';

export default function AddExpensePage() {
  const { token, user, loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    payerId: '',
    beneficiaryIds: []
  });

  const currentUserId = user?._id || user?.id || '';

  useEffect(() => {
    const fetchPeople = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE}/people`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPeople(response.data);
      } catch (err) {
        alert('Failed to load friends.');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchPeople();
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (currentUserId && !expenseForm.payerId) {
      setExpenseForm((prev) => ({ ...prev, payerId: currentUserId }));
    }
  }, [currentUserId, expenseForm.payerId]);

  const formattedPeople = useMemo(() => {
    const byId = new Map();

    if (user && currentUserId) {
      byId.set(String(currentUserId), {
        id: String(currentUserId),
        _id: String(currentUserId),
        name: user.name || 'You'
      });
    }

    people.forEach((person) => {
      const personId = person?._id || person?.id;
      if (!personId) return;
      byId.set(String(personId), {
        ...person,
        id: String(personId),
        _id: String(personId),
        name: person?.name || 'Unknown'
      });
    });

    return Array.from(byId.values());
  }, [people, user, currentUserId]);

  const toggleBeneficiary = (id) => {
    setExpenseForm((prev) => {
      const isSelected = prev.beneficiaryIds.includes(id);
      return {
        ...prev,
        beneficiaryIds: isSelected
          ? prev.beneficiaryIds.filter((beneficiaryId) => beneficiaryId !== id)
          : [...prev.beneficiaryIds, id]
      };
    });
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const { description, amount, payerId, beneficiaryIds } = expenseForm;

    if (!description?.trim()) {
      alert('Please enter a description.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount (must be greater than 0).');
      return;
    }
    if (!payerId) {
      alert('Please select who paid.');
      return;
    }
    if (beneficiaryIds.length === 0) {
      alert('Please select at least one person to split the expense with.');
      return;
    }

    try {
      await axios.post(`${API_BASE}/expenses`, {
        description: description.trim(),
        amount: parseFloat(amount),
        payerId,
        beneficiaryIds,
        date: new Date().toLocaleDateString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setExpenseForm({ description: '', amount: '', payerId: currentUserId, beneficiaryIds: [] });
      alert('✅ Expense added successfully!');
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      alert(`❌ Failed to add expense:\n\n${errorMessage}`);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="app" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header className="app-header" style={{ marginBottom: '1.5rem', textAlign: 'center', position: 'relative' }}>
        <div className="header-actions" style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/approvals" className="btn-outline" style={{ textDecoration: 'none' }}>Approvals</Link>
          <Link to="/" className="btn-outline" style={{ textDecoration: 'none' }}>Back to Home</Link>
        </div>
        <h1 className="app-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Add Expense</h1>
      </header>

      <section className="glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Receipt className="accent" size={24} color="var(--accent-color)" />
          <h2>Create New Expense</h2>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Loading friends...</p>
        ) : (
          <form onSubmit={addExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              placeholder="Description (e.g. Dinner)"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              required
            />

            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount (e.g. 300.50)"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Who Paid?</label>
              <select
                value={expenseForm.payerId}
                onChange={(e) => setExpenseForm({ ...expenseForm, payerId: e.target.value })}
              >
                <option value="">Select payer</option>
                {formattedPeople.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                Split Between ({expenseForm.beneficiaryIds.length} selected)
              </label>
              <div className="multi-select">
                {formattedPeople.map((person) => (
                  <div
                    key={person.id}
                    className={`selectable-item ${expenseForm.beneficiaryIds.includes(person.id) ? 'selected' : ''}`}
                    onClick={() => toggleBeneficiary(person.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {person.name}
                  </div>
                ))}
              </div>
            </div>

            {expenseForm.description && expenseForm.amount && expenseForm.payerId && expenseForm.beneficiaryIds.length > 0 && (
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>Summary:</strong> {formattedPeople.find((person) => person.id === expenseForm.payerId)?.name} paid ₹{parseFloat(expenseForm.amount).toFixed(2)} for {expenseForm.beneficiaryIds.length} people = ₹{(parseFloat(expenseForm.amount) / expenseForm.beneficiaryIds.length).toFixed(2)} each
                </p>
              </div>
            )}

            <button className="btn-primary" type="submit" style={{ justifyContent: 'center' }}>
              Add Expense
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
