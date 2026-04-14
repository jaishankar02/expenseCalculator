import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthPage from './AuthPage';
import { API_BASE } from '../config';

const PAGE_SIZE = 5;

export default function ApprovalsPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);

  const [incomingFriendRequests, setIncomingFriendRequests] = useState([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState([]);
  const [incomingFriendPage, setIncomingFriendPage] = useState(1);
  const [outgoingFriendPage, setOutgoingFriendPage] = useState(1);
  const [incomingFriendTotalPages, setIncomingFriendTotalPages] = useState(1);
  const [outgoingFriendTotalPages, setOutgoingFriendTotalPages] = useState(1);

  const [receivedSettlementRequests, setReceivedSettlementRequests] = useState([]);
  const [sentSettlementRequests, setSentSettlementRequests] = useState([]);
  const [receivedSettlementPage, setReceivedSettlementPage] = useState(1);
  const [sentSettlementPage, setSentSettlementPage] = useState(1);
  const [receivedSettlementTotalPages, setReceivedSettlementTotalPages] = useState(1);
  const [sentSettlementTotalPages, setSentSettlementTotalPages] = useState(1);

  const [incomingDeleteRequests, setIncomingDeleteRequests] = useState([]);
  const [outgoingDeleteRequests, setOutgoingDeleteRequests] = useState([]);
  const [incomingDeletePage, setIncomingDeletePage] = useState(1);
  const [outgoingDeletePage, setOutgoingDeletePage] = useState(1);
  const [incomingDeleteTotalPages, setIncomingDeleteTotalPages] = useState(1);
  const [outgoingDeleteTotalPages, setOutgoingDeleteTotalPages] = useState(1);

  const [requestActionLoadingId, setRequestActionLoadingId] = useState('');

  const applyPagedPayload = (payload, setItems, setTotalPages) => {
    if (Array.isArray(payload)) {
      setItems(payload);
      setTotalPages(1);
      return;
    }

    setItems(payload?.items || []);
    setTotalPages(payload?.totalPages || 1);
  };

  const fetchApprovals = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);

      const [
        incomingFriendRes,
        outgoingFriendRes,
        receivedSettlementRes,
        sentSettlementRes,
        incomingDeleteRes,
        outgoingDeleteRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/users/friend-requests?type=incoming&page=${incomingFriendPage}&limit=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/users/friend-requests?type=outgoing&page=${outgoingFriendPage}&limit=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/settlements/received?status=pending&page=${receivedSettlementPage}&limit=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/settlements/sent?status=pending&page=${sentSettlementPage}&limit=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/expenses/delete-requests?type=incoming&status=pending&page=${incomingDeletePage}&limit=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/expenses/delete-requests?type=outgoing&status=pending&page=${outgoingDeletePage}&limit=${PAGE_SIZE}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      applyPagedPayload(incomingFriendRes.data, setIncomingFriendRequests, setIncomingFriendTotalPages);
      applyPagedPayload(outgoingFriendRes.data, setOutgoingFriendRequests, setOutgoingFriendTotalPages);
      applyPagedPayload(receivedSettlementRes.data, setReceivedSettlementRequests, setReceivedSettlementTotalPages);
      applyPagedPayload(sentSettlementRes.data, setSentSettlementRequests, setSentSettlementTotalPages);
      applyPagedPayload(incomingDeleteRes.data, setIncomingDeleteRequests, setIncomingDeleteTotalPages);
      applyPagedPayload(outgoingDeleteRes.data, setOutgoingDeleteRequests, setOutgoingDeleteTotalPages);
    } catch (err) {
      alert('Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }, [
    token,
    incomingFriendPage,
    outgoingFriendPage,
    receivedSettlementPage,
    sentSettlementPage,
    incomingDeletePage,
    outgoingDeletePage
  ]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchApprovals();
    }
  }, [isAuthenticated, fetchApprovals]);

  useEffect(() => {
    if (incomingFriendPage > incomingFriendTotalPages) {
      setIncomingFriendPage(incomingFriendTotalPages);
    }
  }, [incomingFriendPage, incomingFriendTotalPages]);

  useEffect(() => {
    if (outgoingFriendPage > outgoingFriendTotalPages) {
      setOutgoingFriendPage(outgoingFriendTotalPages);
    }
  }, [outgoingFriendPage, outgoingFriendTotalPages]);

  useEffect(() => {
    if (receivedSettlementPage > receivedSettlementTotalPages) {
      setReceivedSettlementPage(receivedSettlementTotalPages);
    }
  }, [receivedSettlementPage, receivedSettlementTotalPages]);

  useEffect(() => {
    if (sentSettlementPage > sentSettlementTotalPages) {
      setSentSettlementPage(sentSettlementTotalPages);
    }
  }, [sentSettlementPage, sentSettlementTotalPages]);

  useEffect(() => {
    if (incomingDeletePage > incomingDeleteTotalPages) {
      setIncomingDeletePage(incomingDeleteTotalPages);
    }
  }, [incomingDeletePage, incomingDeleteTotalPages]);

  useEffect(() => {
    if (outgoingDeletePage > outgoingDeleteTotalPages) {
      setOutgoingDeletePage(outgoingDeleteTotalPages);
    }
  }, [outgoingDeletePage, outgoingDeleteTotalPages]);

  const respondToFriendRequest = async (requestId, action) => {
    try {
      setRequestActionLoadingId(requestId);
      await axios.post(`${API_BASE}/users/friend-requests/${requestId}/respond`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to respond to friend request.');
    } finally {
      setRequestActionLoadingId('');
    }
  };

  const respondToSettlementRequest = async (requestId, action) => {
    try {
      setRequestActionLoadingId(requestId);
      await axios.post(`${API_BASE}/settlements/${requestId}/respond`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to respond to settlement request.');
    } finally {
      setRequestActionLoadingId('');
    }
  };

  const respondToDeleteRequest = async (requestId, action) => {
    try {
      setRequestActionLoadingId(requestId);
      await axios.post(`${API_BASE}/expenses/delete-requests/${requestId}/respond`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to respond to delete request.');
    } finally {
      setRequestActionLoadingId('');
    }
  };

  const hasAnyApprovals =
    incomingFriendRequests.length > 0 ||
    outgoingFriendRequests.length > 0 ||
    receivedSettlementRequests.length > 0 ||
    sentSettlementRequests.length > 0 ||
    incomingDeleteRequests.length > 0 ||
    outgoingDeleteRequests.length > 0;

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
          <Link to="/" className="btn-outline" style={{ textDecoration: 'none' }}>Back to Home</Link>
        </div>
        <h1 className="app-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>Approvals</h1>
      </header>

      <section className="glass" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <ShieldCheck size={24} color="var(--accent-color)" />
          <h2>All Pending Approvals</h2>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Loading approvals...</p>
        ) : !hasAnyApprovals ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem 0' }}>No pending approvals 🎉</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {incomingFriendRequests.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.08)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Incoming Friend Requests</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {incomingFriendRequests.map((request) => (
                    <div key={request._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: 600 }}>{request.fromUserId?.name || 'User'}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📞 {request.fromUserId?.phone || '-'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-primary" disabled={requestActionLoadingId === request._id} onClick={() => respondToFriendRequest(request._id, 'accept')}>
                          {requestActionLoadingId === request._id ? 'Processing...' : 'Accept'}
                        </button>
                        <button className="btn-outline" disabled={requestActionLoadingId === request._id} onClick={() => respondToFriendRequest(request._id, 'reject')}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {incomingFriendTotalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn-outline" disabled={incomingFriendPage === 1} onClick={() => setIncomingFriendPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                    <span style={{ color: 'var(--text-secondary)' }}>Page {incomingFriendPage} of {incomingFriendTotalPages}</span>
                    <button className="btn-outline" disabled={incomingFriendPage === incomingFriendTotalPages} onClick={() => setIncomingFriendPage((prev) => Math.min(incomingFriendTotalPages, prev + 1))}>Next</button>
                  </div>
                )}
              </div>
            )}

            {outgoingFriendRequests.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(250, 204, 21, 0.08)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Pending Friend Requests Sent</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {outgoingFriendRequests.map((request) => (
                    <p key={request._id} style={{ fontSize: '0.9rem' }}>
                      Waiting response from {request.toUserId?.name || 'user'}
                    </p>
                  ))}
                </div>

                {outgoingFriendTotalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn-outline" disabled={outgoingFriendPage === 1} onClick={() => setOutgoingFriendPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                    <span style={{ color: 'var(--text-secondary)' }}>Page {outgoingFriendPage} of {outgoingFriendTotalPages}</span>
                    <button className="btn-outline" disabled={outgoingFriendPage === outgoingFriendTotalPages} onClick={() => setOutgoingFriendPage((prev) => Math.min(outgoingFriendTotalPages, prev + 1))}>Next</button>
                  </div>
                )}
              </div>
            )}

            {receivedSettlementRequests.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.08)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Settlement Approvals For You</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {receivedSettlementRequests.map((request) => (
                    <div key={request._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: 600 }}>{request.fromUserId?.name || 'User'} says they paid you ₹{Number(request.amount).toFixed(2)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-primary" disabled={requestActionLoadingId === request._id} onClick={() => respondToSettlementRequest(request._id, 'approve')}>
                          {requestActionLoadingId === request._id ? 'Processing...' : 'Approve'}
                        </button>
                        <button className="btn-outline" disabled={requestActionLoadingId === request._id} onClick={() => respondToSettlementRequest(request._id, 'reject')}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {receivedSettlementTotalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn-outline" disabled={receivedSettlementPage === 1} onClick={() => setReceivedSettlementPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                    <span style={{ color: 'var(--text-secondary)' }}>Page {receivedSettlementPage} of {receivedSettlementTotalPages}</span>
                    <button className="btn-outline" disabled={receivedSettlementPage === receivedSettlementTotalPages} onClick={() => setReceivedSettlementPage((prev) => Math.min(receivedSettlementTotalPages, prev + 1))}>Next</button>
                  </div>
                )}
              </div>
            )}

            {sentSettlementRequests.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(250, 204, 21, 0.08)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Pending Settlement Requests Sent</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {sentSettlementRequests.map((request) => (
                    <p key={request._id} style={{ fontSize: '0.9rem' }}>
                      Waiting approval from {request.toUserId?.name || 'user'} for ₹{Number(request.amount).toFixed(2)}
                    </p>
                  ))}
                </div>

                {sentSettlementTotalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn-outline" disabled={sentSettlementPage === 1} onClick={() => setSentSettlementPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                    <span style={{ color: 'var(--text-secondary)' }}>Page {sentSettlementPage} of {sentSettlementTotalPages}</span>
                    <button className="btn-outline" disabled={sentSettlementPage === sentSettlementTotalPages} onClick={() => setSentSettlementPage((prev) => Math.min(sentSettlementTotalPages, prev + 1))}>Next</button>
                  </div>
                )}
              </div>
            )}

            {incomingDeleteRequests.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.08)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Delete Approval Requests For You</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {incomingDeleteRequests.map((request) => (
                    <div key={request._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                      <div>
                        <p style={{ fontWeight: 600 }}>{request.requesterId?.name || 'User'} wants to delete: {request.expenseId?.description || 'Transaction'}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>₹{Number(request.expenseId?.amount || 0).toFixed(2)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-primary" disabled={requestActionLoadingId === request._id} onClick={() => respondToDeleteRequest(request._id, 'approve')}>
                          {requestActionLoadingId === request._id ? 'Processing...' : 'Approve'}
                        </button>
                        <button className="btn-outline" disabled={requestActionLoadingId === request._id} onClick={() => respondToDeleteRequest(request._id, 'reject')}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {incomingDeleteTotalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn-outline" disabled={incomingDeletePage === 1} onClick={() => setIncomingDeletePage((prev) => Math.max(1, prev - 1))}>Previous</button>
                    <span style={{ color: 'var(--text-secondary)' }}>Page {incomingDeletePage} of {incomingDeleteTotalPages}</span>
                    <button className="btn-outline" disabled={incomingDeletePage === incomingDeleteTotalPages} onClick={() => setIncomingDeletePage((prev) => Math.min(incomingDeleteTotalPages, prev + 1))}>Next</button>
                  </div>
                )}
              </div>
            )}

            {outgoingDeleteRequests.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(250, 204, 21, 0.08)' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Pending Delete Requests Sent</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {outgoingDeleteRequests.map((request) => (
                    <p key={request._id} style={{ fontSize: '0.9rem' }}>
                      Waiting approval from {request.approverId?.name || 'user'} for {request.expenseId?.description || 'transaction'}
                    </p>
                  ))}
                </div>

                {outgoingDeleteTotalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.75rem' }}>
                    <button className="btn-outline" disabled={outgoingDeletePage === 1} onClick={() => setOutgoingDeletePage((prev) => Math.max(1, prev - 1))}>Previous</button>
                    <span style={{ color: 'var(--text-secondary)' }}>Page {outgoingDeletePage} of {outgoingDeleteTotalPages}</span>
                    <button className="btn-outline" disabled={outgoingDeletePage === outgoingDeleteTotalPages} onClick={() => setOutgoingDeletePage((prev) => Math.min(outgoingDeleteTotalPages, prev + 1))}>Next</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
