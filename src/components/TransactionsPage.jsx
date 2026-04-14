import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Receipt, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthPage from './AuthPage';
import { API_BASE } from '../config';

const PAGE_SIZE = 8;

export default function TransactionsPage() {
  const { token, user, loading: authLoading, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [people, setPeople] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [expensesRes, peopleRes] = await Promise.all([
        axios.get(`${API_BASE}/expenses?page=${page}&limit=${PAGE_SIZE}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/people`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const payload = expensesRes.data;
      if (Array.isArray(payload)) {
        setExpenses(payload);
        setTotal(payload.length);
        setTotalPages(Math.max(1, Math.ceil(payload.length / PAGE_SIZE)));
      } else {
        setExpenses(payload.items || []);
        setTotal(payload.total || 0);
        setTotalPages(payload.totalPages || 1);
      }
      setPeople(peopleRes.data);
    } catch (err) {
      alert('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const removeExpense = async (id) => {
    try {
      await axios.post(`${API_BASE}/expenses/${id}/delete-request`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Delete request sent for approval. Track status in Approvals page.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to request delete.');
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

  const peopleMap = useMemo(() => {
    const map = new Map();
    if (user?._id || user?.id) {
      map.set(String(user._id || user.id), user.name || 'You');
    }
    people.forEach((person) => {
      map.set(String(person._id || person.id), person.name || 'Unknown');
    });
    return map;
  }, [people, user]);

  const formattedExpenses = useMemo(() => {
    return expenses.map((exp) => {
      const payerId = typeof exp.payerId === 'object' ? exp.payerId?._id || exp.payerId?.id : exp.payerId;
      const beneficiaryIds = (exp.beneficiaryIds || []).map((beneficiary) =>
        typeof beneficiary === 'object' ? beneficiary?._id || beneficiary?.id : beneficiary
      );

      return {
        ...exp,
        id: exp._id,
        payerId,
        beneficiaryIds
      };
    });
  }, [expenses]);

  const currentPage = Math.min(page, totalPages);
  const startIndex = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, total);

  const goToPrev = () => setPage((prev) => Math.max(1, prev - 1));
  const goToNext = () => setPage((prev) => Math.min(totalPages, prev + 1));

  return (
    <div className="app" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header className="app-header" style={{ marginBottom: '1.5rem', textAlign: 'center', position: 'relative' }}>
        <div className="header-actions" style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/approvals" className="btn-outline" style={{ textDecoration: 'none' }}>Approvals</Link>
          <Link to="/" className="btn-outline" style={{ textDecoration: 'none' }}>Back to Home</Link>
        </div>
        <h1 className="app-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Transactions</h1>
      </header>

      <section className="glass" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Receipt size={24} color="var(--accent-color)" />
            <h2>Expense History</h2>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Showing {startIndex}-{endIndex} of {total}
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Loading transactions...</p>
        ) : (
          <div className="expense-list">
            {formattedExpenses.map((exp) => (
              <div key={exp.id} className="expense-item">
                <div>
                  <h4 style={{ marginBottom: '0.25rem' }}>{exp.description}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Paid by <span style={{ color: 'var(--text-primary)' }}>{peopleMap.get(String(exp.payerId)) || 'Unknown'}</span> • {exp.date}
                  </p>
                </div>

                <div className="expense-meta" style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>₹{Number(exp.amount).toFixed(2)}</span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {exp.beneficiaryIds.length} people involved
                    </div>
                  </div>
                  <button onClick={() => removeExpense(exp.id)} style={{ background: 'transparent', color: 'var(--danger)' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {!loading && total === 0 && (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No transactions yet.
              </p>
            )}
          </div>
        )}

        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button className="btn-outline" onClick={goToPrev} disabled={currentPage === 1}>
              Previous
            </button>
            <span style={{ color: 'var(--text-secondary)' }}>Page {currentPage} of {totalPages}</span>
            <button className="btn-outline" onClick={goToNext} disabled={currentPage === totalPages}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
