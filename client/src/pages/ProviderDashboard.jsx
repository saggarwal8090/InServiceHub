import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Check, X, Calendar, User, MapPin, Phone, Send, Bell } from 'lucide-react';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ProviderDashboard = () => {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [broadcastRequests, setBroadcastRequests] = useState([]);
    const [isOnline, setIsOnline] = useState(user?.is_online || false);
    const [acceptingId, setAcceptingId] = useState(null);

    useEffect(() => {
        fetchBookings();
        fetchBroadcastRequests();
        // Auto-refresh broadcast requests every 8 seconds
        const interval = setInterval(fetchBroadcastRequests, 8000);
        return () => clearInterval(interval);
    }, []);

    const fetchBookings = async () => {
        try {
            const res = await axios.get(`${API_URL}/my-bookings`);
            setBookings(res.data);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
            setBookings([]);
        }
    };

    const fetchBroadcastRequests = async () => {
        try {
            const res = await axios.get(`${API_URL}/booking-requests`);
            setBroadcastRequests(res.data);
        } catch (error) {
            console.error('Failed to fetch broadcast requests:', error);
            setBroadcastRequests([]);
        }
    };

    const toggleOnline = async () => {
        try {
            const res = await axios.put(`${API_URL}/toggle-online`);
            setIsOnline(res.data.is_online);
        } catch (error) {
            console.error('Failed to toggle status:', error);
            alert(error.response?.data?.message || 'Unable to update your status. Please try again.');
        }
    };

    const acceptRequest = async (bookingId) => {
        setAcceptingId(bookingId);
        try {
            await axios.put(`${API_URL}/bookings/${bookingId}/accept`);
            // Refresh both lists
            fetchBookings();
            fetchBroadcastRequests();
        } catch (error) {
            console.error('Failed to accept request:', error);
            alert(error.response?.data?.message || 'Failed to accept request');
        } finally {
            setAcceptingId(null);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await axios.put(`${API_URL}/bookings/${id}/status`, { status });
            fetchBookings();
        } catch (error) {
            console.error('Failed to update status:', error);
            alert(error.response?.data?.message || 'Unable to update booking status. Please try again.');
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h2>Provider Dashboard</h2>
                    <p className="dashboard-subtitle">Manage your bookings and availability</p>
                </div>
                <div className="status-toggle">
                    <span>Status: {isOnline ? 'Online 🟢' : 'Offline 🔴'}</span>
                    <button onClick={toggleOnline} className={isOnline ? 'btn-offline' : 'btn-online'}>
                        Go {isOnline ? 'Offline' : 'Online'}
                    </button>
                </div>
            </div>

            {/* BROADCAST REQUESTS — new requests from customers in your city */}
            <div className="dashboard-section">
                <h3 className="section-title-with-badge">
                    <Bell size={18} /> New Requests in Your Area
                    {broadcastRequests.length > 0 && (
                        <span className="request-count-badge">{broadcastRequests.length}</span>
                    )}
                </h3>
                {broadcastRequests.length === 0 ? (
                    <div className="empty-state">
                        <Send size={48} color="#ccc" />
                        <p>No new requests right now. Stay online to receive requests from customers in your city!</p>
                    </div>
                ) : (
                    <div className="booking-list">
                        {broadcastRequests.map(req => (
                            <div key={req.id} className="booking-card broadcast-request">
                                <div className="booking-info">
                                    <div className="new-request-badge">
                                        <Bell size={12} /> New Request
                                    </div>
                                    <h4>{req.service_type}</h4>
                                    <p><User size={14} /> {req.customer_name}</p>
                                    <p><Calendar size={14} /> {new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {req.time}</p>
                                    <p className="address"><MapPin size={14} /> {req.address}</p>
                                    {req.description && <p className="request-description">"{req.description}"</p>}
                                </div>
                                <div className="booking-actions">
                                    <button
                                        className="btn-accept-large"
                                        onClick={() => acceptRequest(req.id)}
                                        disabled={acceptingId === req.id}
                                    >
                                        <Check size={18} /> {acceptingId === req.id ? 'Accepting...' : 'Accept Request'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MY BOOKINGS — accepted/completed bookings assigned to this provider */}
            <div className="dashboard-section">
                <h3>My Bookings</h3>
                {bookings.length === 0 ? (
                    <div className="empty-state">
                        <Calendar size={48} color="#ccc" />
                        <p>No assigned bookings yet. Accept requests above to get started!</p>
                    </div>
                ) : (
                    <div className="booking-list">
                        {bookings.map(booking => (
                            <div key={booking.id} className={`booking-card ${booking.status}`}>
                                <div className="booking-info">
                                    <h4>{booking.service_name || booking.service_type}</h4>
                                    <p><User size={14} /> {booking.customer_name}</p>
                                    <p><Phone size={14} /> {booking.customer_phone}</p>
                                    <p><Calendar size={14} /> {new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {booking.time}</p>
                                    <p className="address"><MapPin size={14} /> {booking.address}</p>
                                </div>
                                <div className="booking-status">
                                    <span className={`status-badge ${booking.status}`}>{booking.status}</span>
                                </div>
                                {booking.status === 'pending' && (
                                    <div className="booking-actions">
                                        <button className="btn-accept" onClick={() => updateStatus(booking.id, 'accepted')} title="Accept">
                                            <Check size={18} />
                                        </button>
                                        <button className="btn-reject" onClick={() => updateStatus(booking.id, 'cancelled')} title="Reject">
                                            <X size={18} />
                                        </button>
                                    </div>
                                )}
                                {booking.status === 'accepted' && (
                                    <div className="booking-actions">
                                        <button className="btn-complete" onClick={() => updateStatus(booking.id, 'completed')}>
                                            <Check size={16} /> Mark Completed
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProviderDashboard;
