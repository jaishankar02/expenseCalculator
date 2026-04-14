import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Landmark, ChevronRight, Calculator, Wifi, WifiOff, RefreshCcw, LogOut } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { calculateBalances, simplifyDebts } from './utils/splitLogic';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import { API_BASE, SOCKET_BASE } from './config';
import { Link } from 'react-router-dom';

function App() {
  const { user, token, logout, loading: authLoading, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  
  const [people, setPeople] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [activeUpiKey, setActiveUpiKey] = useState('');
  const [confirmingSettlementKey, setConfirmingSettlementKey] = useState('');

  const currentUserId = user?._id || user?.id || '';

  // Initialize socket connection when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      const newSocket = io(SOCKET_BASE, {
        extraHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      newSocket.on('connect', () => setIsOnline(true));
      newSocket.on('disconnect', () => setIsOnline(false));
      newSocket.on('data_changed', () => {
        fetchData();
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [peopleRes, expensesRes, incomingFriendRes, incomingSettlementRes, incomingDeleteRes] = await Promise.all([
        axios.get(`${API_BASE}/people`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/expenses`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/users/friend-requests?type=incoming&page=1&limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/settlements/received?status=pending&page=1&limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/expenses/delete-requests?type=incoming&status=pending&page=1&limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setPeople(peopleRes.data);
      setExpenses(expensesRes.data);

      const friendPayload = incomingFriendRes.data;
      const settlementPayload = incomingSettlementRes.data;
      const deletePayload = incomingDeleteRes.data;

      const getTotalFromPayload = (payload) => {
        if (Array.isArray(payload)) return payload.length;
        return Number(payload?.total || 0);
      };

      const totalPending =
        getTotalFromPayload(friendPayload) +
        getTotalFromPayload(settlementPayload) +
        getTotalFromPayload(deletePayload);

      setPendingApprovalsCount(totalPending);
      setIsOnline(true);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

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

  const formattedPeople = (() => {
    const byId = new Map();

    if (user && currentUserId) {
      byId.set(String(currentUserId), {
        id: String(currentUserId),
        _id: String(currentUserId),
        name: user.name || 'You',
        phone: user.phone || '',
        upiId: user.upiId || ''
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
  })();
  
  // Format expenses - extract IDs from populated objects
  const formattedExpenses = expenses.map(e => {
    let payerId = e.payerId;
    let beneficiaryIds = e.beneficiaryIds || [];
    
    // If payerId is an object, extract the _id
    if (typeof payerId === 'object' && payerId !== null) {
      payerId = payerId._id || payerId.id;
    }
    
    // If beneficiaryIds contains objects, extract the _id
    beneficiaryIds = beneficiaryIds.map(b => {
      if (typeof b === 'object' && b !== null) {
        return b._id || b.id;
      }
      return b;
    });
    
    return {
      ...e,
      id: e._id,
      payerId,
      beneficiaryIds
    };
  });

  // Calculate user's specific balance
  const userBalances = calculateBalances(formattedPeople, formattedExpenses);
  const userBalance = userBalances[currentUserId] || 0;
  
  const balances = calculateBalances(formattedPeople, formattedExpenses);
  const settlements = simplifyDebts(balances, formattedPeople);

  const getSettlementKey = (settlement, idx) => `${settlement.from}-${settlement.to}-${idx}`;

  const getUpiFromName = (name) => {
    const person = formattedPeople.find((p) => p.name === name);
    return (person?.upiId || '').toString();
  };

  const buildUpiLink = (upiId, payeeName, amount) => {
    const normalizedUpiId = (upiId || '').trim().toLowerCase();
    const params = new URLSearchParams({
      pa: normalizedUpiId,
      pn: payeeName,
      am: Number(amount).toFixed(2),
      cu: 'INR',
      tn: `Hishab settlement to ${payeeName}`
    });
    return `upi://pay?${params.toString()}`;
  };

  const confirmSettlementPaid = async (settlement, idx) => {
    const settlementKey = getSettlementKey(settlement, idx);
    const confirmed = window.confirm(
      `Confirm payment: ₹${Number(settlement.amount).toFixed(2)} paid to ${settlement.to}?\n\nA request will be sent to receiver for approval.`
    );

    if (!confirmed) return;

    try {
      setConfirmingSettlementKey(settlementKey);

      await axios.post(`${API_BASE}/settlements/request`, {
        toUserId: settlement.toId,
        amount: Number(settlement.amount)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActiveUpiKey('');
      fetchData();
      alert('✅ Payment request sent. Balances will update after receiver approval.');
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      alert(`❌ Could not send approval request: ${errorMessage}`);
    } finally {
      setConfirmingSettlementKey('');
    }
  };

  return (
    <div className="app">
      <header className="app-header" style={{ marginBottom: '3rem', textAlign: 'center', position: 'relative' }}>
        <div className="header-actions" style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              👤 {user?.name}
            </div>
            {isOnline ? <Wifi size={18} color="var(--success)" title="Online" /> : <WifiOff size={18} color="var(--danger)" title="Offline" />}
            <button onClick={fetchData} className="btn-outline" style={{ padding: '0.25rem' }}><RefreshCcw size={16} /></button>
            <button onClick={logout} className="btn-outline" style={{ padding: '0.25rem' }} title="Logout"><LogOut size={16} /></button>
        </div>
        <h1 className="app-title" style={{ fontSize: '3rem', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>
          HishabChecker
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Synced via Node.js + MongoDB Atlas</p>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>Connecting to server...</div>
      ) : (
        <div className="grid">
          <section className="glass" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
              <Link to="/add-expense" className="btn-outline" style={{ textDecoration: 'none' }}>Add Expense</Link>
              <Link to="/friends" className="btn-outline" style={{ textDecoration: 'none' }}>Friends</Link>
              <Link to="/approvals" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Approvals</span>
                {pendingApprovalsCount > 0 && (
                  <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: '999px', minWidth: '1.35rem', height: '1.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, padding: '0 0.35rem', lineHeight: 1 }}>
                    {pendingApprovalsCount}
                  </span>
                )}
              </Link>
              <Link to="/transactions" className="btn-outline" style={{ textDecoration: 'none' }}>Transactions</Link>
            </div>
          </section>

          {/* Your Balance Section */}
          <section className="glass" style={{ gridColumn: '1 / -1', background: userBalance < -0.01 ? 'rgba(239, 68, 68, 0.1)' : userBalance > 0.01 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Landmark className="accent" size={24} color="var(--accent-color)" />
              <h2>Your Balance</h2>
            </div>
            
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              {userBalance < -0.01 ? (
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>You Owe</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>₹{Math.abs(userBalance).toFixed(2)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Pay your friends to settle all debts</p>
                </div>
              ) : userBalance > 0.01 ? (
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>You Are Owed</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#22c55e' }}>₹{userBalance.toFixed(2)}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Your friends owe you this amount</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>All Settled</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#6b7280' }}>₹0.00</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>You're all caught up!</p>
                </div>
              )}
            </div>
          </section>

          {/* Settlements Section */}
          <section className="glass" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Receipt size={24} color="var(--accent-color)" />
              <h2>Who Owes Whom</h2>
            </div>

            {settlements.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {settlements.map((s, idx) => {
                  const isYouFrom = s.fromId === currentUserId;
                  const isYouTo = s.toId === currentUserId;
                  const settlementKey = getSettlementKey(s, idx);
                  const receiverUpiId = getUpiFromName(s.to);
                  const upiLink = receiverUpiId ? buildUpiLink(receiverUpiId, s.to, s.amount) : '';
                  const qrLink = upiLink
                    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`
                    : '';
                  
                  return (
                    <div key={idx} className="settlement-row" style={{ 
                      padding: '1rem', 
                      background: isYouFrom || isYouTo ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255,255,255,0.03)', 
                      borderStyle: 'solid',
                      border: isYouFrom || isYouTo ? '2px solid #ffc107' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0.5rem'
                    }}>
                      <div className="settlement-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '1.1rem', color: isYouFrom ? '#ef4444' : 'var(--text-primary)' }}>
                          {s.from}
                          {isYouFrom && ' (You)'}
                        </span>
                        <div className="settlement-amount" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '200px', justifyContent: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>pays</span>
                          <ChevronRight size={16} />
                          <span style={{ 
                            fontSize: '1.3rem', 
                            fontWeight: 700, 
                            color: isYouFrom ? '#ef4444' : isYouTo ? '#22c55e' : 'var(--accent-color)',
                            background: isYouFrom || isYouTo ? 'rgba(255, 193, 7, 0.2)' : 'transparent',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.25rem'
                          }}>
                            ₹{s.amount.toFixed(2)}
                          </span>
                          <ChevronRight size={16} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '1.1rem', color: isYouTo ? '#22c55e' : 'var(--text-primary)' }}>
                          {s.to}
                          {isYouTo && ' (You)'}
                        </span>
                      </div>

                      {isYouFrom && (
                        <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '1rem' }}>
                          <button
                            onClick={() => setActiveUpiKey(activeUpiKey === settlementKey ? '' : settlementKey)}
                            className="btn-primary"
                            style={{ marginBottom: activeUpiKey === settlementKey ? '0.75rem' : 0 }}
                          >
                            {activeUpiKey === settlementKey ? 'Hide UPI Payment' : 'Pay Now via UPI'}
                          </button>

                          {activeUpiKey === settlementKey && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Paying to UPI ID: <strong>{receiverUpiId || 'Not available'}</strong>
                              </div>

                              <div className="upi-app-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <a
                                  href={upiLink || '#'}
                                  onClick={(e) => !upiLink && e.preventDefault()}
                                  className="btn-outline"
                                  style={{ opacity: upiLink ? 1 : 0.5, pointerEvents: upiLink ? 'auto' : 'none' }}
                                >
                                  Open in GPay
                                </a>
                                <a
                                  href={upiLink || '#'}
                                  onClick={(e) => !upiLink && e.preventDefault()}
                                  className="btn-outline"
                                  style={{ opacity: upiLink ? 1 : 0.5, pointerEvents: upiLink ? 'auto' : 'none' }}
                                >
                                  Open in PhonePe
                                </a>
                                <a
                                  href={upiLink || '#'}
                                  onClick={(e) => !upiLink && e.preventDefault()}
                                  className="btn-outline"
                                  style={{ opacity: upiLink ? 1 : 0.5, pointerEvents: upiLink ? 'auto' : 'none' }}
                                >
                                  Open in Paytm
                                </a>
                                <a
                                  href={upiLink || '#'}
                                  onClick={(e) => !upiLink && e.preventDefault()}
                                  className="btn-outline"
                                  style={{ opacity: upiLink ? 1 : 0.5, pointerEvents: upiLink ? 'auto' : 'none' }}
                                >
                                  Open in BHIM
                                </a>
                              </div>

                              {!receiverUpiId && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                                  This user has no UPI ID saved. Ask them to re-register with a valid UPI ID.
                                </p>
                              )}

                              {upiLink && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                                  <img
                                    src={qrLink}
                                    alt="UPI payment QR"
                                    width="160"
                                    height="160"
                                    style={{ borderRadius: '0.5rem', background: '#fff', padding: '0.35rem' }}
                                  />
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Scan this QR with any UPI app to pay ₹{s.amount.toFixed(2)}.
                                  </p>
                                </div>
                              )}

                              <button
                                onClick={() => confirmSettlementPaid(s, idx)}
                                disabled={confirmingSettlementKey === settlementKey}
                                className="btn-primary mobile-full"
                                style={{ width: 'fit-content' }}
                              >
                                {confirmingSettlementKey === settlementKey ? 'Sending...' : 'I Have Paid (Ask Approval)'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
                <Calculator size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p style={{ fontSize: '1.1rem' }}>All settled up! 🎉</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>No pending debts between anyone</p>
              </div>
            )}
          </section>
        </div>
      )}

      <style>{`
        .accent { filter: drop-shadow(0 0 8px var(--accent-glow)); }
      `}</style>
    </div>
  );
}

export default App;
