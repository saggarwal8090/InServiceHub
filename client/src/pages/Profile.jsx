import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Phone, MapPin, Briefcase, Shield, Star,
    Calendar, Edit3, Save, X, Lock, Eye, EyeOff, CheckCircle,
    Wrench, IndianRupee, FileText, Clock, Award
} from 'lucide-react';
import './Profile.css';

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Chandigarh', 'Kochi', 'Indore', 'Bhopal', 'Nagpur',
    'Surat', 'Vadodara', 'Noida', 'Gurgaon', 'Ghaziabad'
];

const Profile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Edit form state
    const [form, setForm] = useState({
        name: '', phone: '', city: '',
        experience: 0, price: 0, description: '', service_name: ''
    });

    // Change password state
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '', newPassword: '', confirmPassword: ''
    });
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const fetchProfile = useCallback(async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || '/api';
            const res = await axios.get(`${API_URL}/profile`);
            setProfile(res.data);
            setForm({
                name: res.data.name || '',
                phone: res.data.phone || '',
                city: res.data.city || '',
                experience: res.data.providerDetails?.experience || 0,
                price: res.data.service?.price || 0,
                description: res.data.providerDetails?.description || '',
                service_name: res.data.service?.service_name || ''
            });
        } catch (err) {
            console.error('Failed to fetch profile:', err);
            if (err.response?.status === 401 || err.response?.status === 403) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchProfile();
    }, [fetchProfile, navigate, user]);

    const showMsg = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || '/api';
            const res = await axios.put(`${API_URL}/profile`, form);
            // Update localStorage user
            const updatedUser = res.data.user;
            if (updatedUser) {
                localStorage.setItem('user', JSON.stringify(updatedUser));
            }
            setEditing(false);
            showMsg('✅ Profile updated successfully!');
            fetchProfile();
        } catch (err) {
            console.error(err);
            
            showMsg('❌ Failed to update profile. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showMsg('❌ New passwords do not match.', 'error');
            return;
        }
        if (passwordForm.newPassword.length < 8) {
            showMsg('New password must be at least 8 characters.', 'error');
            return;
        }
        setChangingPassword(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || '/api';
            await axios.put(`${API_URL}/change-password`, {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            showMsg(profile.has_password ? '✅ Password changed successfully!' : '✅ Password set successfully!');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setShowPasswordSection(false);
            fetchProfile();
        } catch (err) {
            showMsg(`❌ ${err.response?.data?.message || 'Failed to change password.'}`, 'error');
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="spinner"></div>
                <p>Loading your profile...</p>
            </div>
        );
    }

    if (!profile) return null;

    const memberSince = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'N/A';

    return (
        <div className="profile-container page-enter">
            {/* Message Toast */}
            {message.text && (
                <div className={`profile-toast ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Profile Header Card */}
            <div className="profile-header-card">
                <div className="profile-avatar">
                    <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=667eea&color=fff&size=128&bold=true`}
                        alt={profile.name}
                    />
                    {profile.role === 'provider' && profile.providerDetails?.verified && (
                        <div className="verified-badge-profile" title="Verified Provider">
                            <Shield size={14} />
                        </div>
                    )}
                </div>
                <div className="profile-header-info">
                    <h1>{profile.name}</h1>
                    <div className="profile-role-badge">
                        {profile.role === 'provider' ? '🔧 Service Provider' : '👤 Customer'}
                    </div>
                    <div className="profile-meta">
                        <span><MapPin size={14} /> {profile.city || 'Not set'}</span>
                        <span><Calendar size={14} /> Member since {memberSince}</span>
                    </div>
                </div>
                <div className="profile-header-stats">
                    <div className="stat-box">
                        <span className="stat-number">{profile.bookingCount || 0}</span>
                        <span className="stat-label">{profile.role === 'provider' ? 'Jobs Done' : 'Bookings'}</span>
                    </div>
                    {profile.role === 'provider' && profile.providerDetails && (
                        <>
                            <div className="stat-box">
                                <span className="stat-number">
                                    <Star size={14} fill="#FFD700" stroke="#FFD700" /> {profile.providerDetails.rating || '0'}
                                </span>
                                <span className="stat-label">Rating</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-number">{profile.providerDetails.total_reviews || 0}</span>
                                <span className="stat-label">Reviews</span>
                            </div>
                        </>
                    )}
                </div>
                {!editing && (
                    <button className="btn-edit-profile" onClick={() => setEditing(true)}>
                        <Edit3 size={16} /> Edit Profile
                    </button>
                )}
            </div>

            {/* Profile Details Section */}
            <div className="profile-sections">
                {/* Personal Info */}
                <div className="profile-section-card">
                    <h3><User size={18} /> Personal Information</h3>
                    <div className="profile-fields">
                        <div className="profile-field">
                            <label><User size={14} /> Full Name</label>
                            {editing ? (
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            ) : (
                                <p>{profile.name}</p>
                            )}
                        </div>
                        <div className="profile-field">
                            <label><Mail size={14} /> Email</label>
                            <p className="field-readonly">{profile.email} <Lock size={12} title="Email cannot be changed" /></p>
                        </div>
                        <div className="profile-field">
                            <label><Phone size={14} /> Phone</label>
                            {editing ? (
                                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                            ) : (
                                <p>{profile.phone || <span className="not-set">Not set</span>}</p>
                            )}
                        </div>
                        <div className="profile-field">
                            <label><MapPin size={14} /> City</label>
                            {editing ? (
                                <select value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}>
                                    <option value="">Select city</option>
                                    {indianCities.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            ) : (
                                <p>{profile.city || <span className="not-set">Not set</span>}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Provider Details — only for providers */}
                {profile.role === 'provider' && (
                    <div className="profile-section-card provider-section">
                        <h3><Wrench size={18} /> Service Details</h3>
                        <div className="profile-fields">
                            <div className="profile-field">
                                <label><Briefcase size={14} /> Service</label>
                                {editing ? (
                                    <input value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} placeholder="e.g. Plumber, Electrician" />
                                ) : (
                                    <p>{profile.service?.service_name || profile.providerDetails?.service_category || <span className="not-set">Not set</span>}</p>
                                )}
                            </div>
                            <div className="profile-field">
                                <label><Clock size={14} /> Experience (years)</label>
                                {editing ? (
                                    <input type="number" min="0" max="50" value={form.experience} onChange={e => setForm({ ...form, experience: parseInt(e.target.value) || 0 })} />
                                ) : (
                                    <p>{profile.providerDetails?.experience || 0} years</p>
                                )}
                            </div>
                            <div className="profile-field">
                                <label><IndianRupee size={14} /> Hourly Rate (₹)</label>
                                {editing ? (
                                    <input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} />
                                ) : (
                                    <p>₹{profile.service?.price || 0}/hr</p>
                                )}
                            </div>
                            <div className="profile-field full-width">
                                <label><FileText size={14} /> About / Description</label>
                                {editing ? (
                                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tell customers about yourself and your expertise..." rows="3" />
                                ) : (
                                    <p>{profile.providerDetails?.description || <span className="not-set">No description added yet</span>}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Actions */}
                {editing && (
                    <div className="profile-edit-actions">
                        <button className="btn-save" onClick={handleSave} disabled={saving}>
                            {saving ? <><span className="btn-spinner"></span> Saving...</> : <><Save size={16} /> Save Changes</>}
                        </button>
                        <button className="btn-cancel-edit" onClick={() => { setEditing(false); fetchProfile(); }}>
                            <X size={16} /> Cancel
                        </button>
                    </div>
                )}

                {/* Security Section */}
                <div className="profile-section-card">
                    <h3><Shield size={18} /> Security</h3>
                    {!showPasswordSection ? (
                        <button className="btn-change-password" onClick={() => setShowPasswordSection(true)}>
                            <Lock size={16} /> {profile.has_password ? 'Change Password' : 'Set Password'}
                        </button>
                    ) : (
                        <form className="password-form" onSubmit={handleChangePassword}>
                            {profile.has_password && (
                                <div className="profile-field">
                                    <label><Lock size={14} /> Current Password</label>
                                    <div className="pw-input-wrapper">
                                        <input
                                            type={showCurrentPw ? 'text' : 'password'}
                                            value={passwordForm.currentPassword}
                                            onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                            required
                                            placeholder="Enter current password"
                                        />
                                        <button type="button" className="pw-toggle" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                                            {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="profile-field">
                                <label><Lock size={14} /> New Password</label>
                                <div className="pw-input-wrapper">
                                    <input
                                        type={showNewPw ? 'text' : 'password'}
                                        value={passwordForm.newPassword}
                                        onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                        required
                                        minLength="8"
                                        placeholder="Min 8 characters"
                                    />
                                    <button type="button" className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
                                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="profile-field">
                                <label><Lock size={14} /> Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    required
                                    placeholder="Re-enter new password"
                                />
                            </div>
                            <div className="password-actions">
                                <button type="submit" className="btn-save" disabled={changingPassword}>
                                    {changingPassword ? 'Saving...' : profile.has_password ? 'Update Password' : 'Set Password'}
                                </button>
                                <button type="button" className="btn-cancel-edit" onClick={() => {
                                    setShowPasswordSection(false);
                                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Account Info */}
                <div className="profile-section-card account-info">
                    <h3><Award size={18} /> Account</h3>
                    <div className="account-details">
                        <p><strong>Account Type:</strong> {profile.role === 'provider' ? 'Service Provider' : 'Customer'}</p>
                        <p><strong>Member Since:</strong> {memberSince}</p>
                        <p><strong>Total {profile.role === 'provider' ? 'Jobs' : 'Bookings'}:</strong> {profile.bookingCount || 0}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
