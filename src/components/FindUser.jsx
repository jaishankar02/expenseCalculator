import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, AlertCircle, Loader, Users, Trash2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../config';
import { Link } from 'react-router-dom';
import AuthPage from './AuthPage';

export default function FindUser() {
  const { token, addFriend, user, isAuthenticated, loading: authLoading } = useAuth();
  const [searchPhone, setSearchPhone] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [people, setPeople] = useState([]);

  const fetchPeople = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_BASE}/people`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPeople(response.data || []);
    } catch (err) {
      // keep non-blocking for main UI
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPeople();
    }
  }, [token, fetchPeople]);

  const handleSearch = async () => {
    if (!searchPhone.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setFoundUser(null);

    try {
      const response = await axios.get(`${API_BASE}/users/search/${searchPhone}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Check if already a friend
      const isFriend = user?.friends?.some(f => f._id === response.data._id);

      setFoundUser({ ...response.data, isFriend, hasPendingOutgoing: false });
    } catch (err) {
      if (err.response?.status === 404) {
        setError('User not found');
      } else {
        setError(err.response?.data?.error || 'Search failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    try {
      setLoading(true);
      await addFriend(foundUser._id);
      setSuccess(`Friend request sent to ${foundUser.name}`);
      setError('');
      setFoundUser((prev) => ({ ...prev, hasPendingOutgoing: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removePerson = async (id) => {
    try {
      await axios.delete(`${API_BASE}/people/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchPeople();
      setSuccess('Friend removed successfully.');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove friend');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
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
    <div className="app" style={{ maxWidth: '900px', margin: '0 auto', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Friends</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/approvals" className="btn-outline" style={{ textDecoration: 'none' }}>Approvals</Link>
          <Link to="/" className="btn-outline" style={{ textDecoration: 'none' }}>Back to Home</Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="border border-indigo-100 rounded-lg p-4 mb-4 bg-indigo-50">
        <div className="flex items-center gap-2 mb-3">
          <Users size={22} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-800">Friends</h2>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md p-2 border border-indigo-200 bg-white font-semibold text-gray-800">
            <span>👤 {user?.name} (You)</span>
          </div>

          {people.map((person) => (
            <div key={person._id} className="flex items-center justify-between rounded-md p-2 border border-indigo-100 bg-white">
              <span className="text-sm text-gray-800">{person.name}</span>
              <button
                onClick={() => removePerson(person._id)}
                className="text-gray-500 hover:text-red-600"
                title="Remove friend"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {people.length === 0 && (
            <p className="text-sm text-gray-600 text-center">No friends added yet.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search size={24} className="text-indigo-600" />
        <h2 className="text-xl font-bold text-gray-800">Add Friends</h2>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        Search for friends by their phone number to add them to your expense group.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="tel"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter phone number"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
        >
          {loading ? <Loader size={20} className="animate-spin" /> : <Search size={20} />}
          Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-gap-2 mb-4">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {foundUser && (
        <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">{foundUser.name}</h3>
            <p className="text-gray-600 text-sm">📞 {foundUser.phone}</p>
            {foundUser.email && <p className="text-gray-600 text-sm">✉️ {foundUser.email}</p>}
          </div>
          <button
            onClick={handleAddFriend}
            disabled={loading || foundUser.isFriend || foundUser.hasPendingOutgoing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
              foundUser.isFriend
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : foundUser.hasPendingOutgoing
                ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            <Plus size={20} />
            {foundUser.isFriend ? 'Already Friends' : foundUser.hasPendingOutgoing ? 'Request Sent' : 'Add Friend'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
