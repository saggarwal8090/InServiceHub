import React, { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Lock, Phone, MapPin, Briefcase, Wrench, Eye, EyeOff, UserPlus } from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';
import './Auth.css';

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Chandigarh', 'Kochi', 'Indore', 'Bhopal', 'Nagpur',
    'Surat', 'Vadodara', 'Noida', 'Gurgaon', 'Ghaziabad', 'Saharanpur'
];

const serviceCategories = [
    { value: 'Plumber', label: '🔧 Plumber' },
    { value: 'Electrician', label: '⚡ Electrician' },
    { value: 'Carpenter', label: '🪚 Carpenter' },
    { value: 'Painter', label: '🎨 Painter' },
    { value: 'Cleaning', label: '🧹 Cleaning' },
    { value: 'AC Repair', label: '❄️ AC Repair' },
    { value: 'Pest Control', label: '🐛 Pest Control' },
    { value: 'Appliance Repair', label: '🔌 Appliance Repair' },
    { value: 'Home Renovation', label: '🏠 Home Renovation' },
    { value: 'Landscaping', label: '🌿 Landscaping & Gardening' },
    { value: 'Masonry', label: '🧱 Mason / Bricklayer' },
    { value: 'Roofing', label: '🏗️ Roofing' },
    { value: 'Interior Design', label: '🎨 Interior Designer' },
    { value: 'CCTV & Security', label: '📷 CCTV & Security' },
    { value: 'Welding', label: '🔩 Welder' },
    { value: 'Packers & Movers', label: '📦 Packers & Movers' },
];

const Register = () => {
    const [searchParams] = useSearchParams();
    const initialRole = searchParams.get('role') || 'customer';

    const [userData, setUserData] = useState({
        name: '',
        email: '',
        password: '',
        role: initialRole,
        city: '',
        phone: '',
        service_category: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const { register, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const hasGoogleOAuth = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

    const handleChange = (e) => setUserData({ ...userData, [e.target.name]: e.target.value });

    const redirectAfterAuth = useCallback((role) => {
        if (role === 'provider') {
            navigate('/provider-dashboard');
        } else {
            navigate('/');
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (userData.role === 'provider' && !userData.service_category) {
            setError('Please select the service you will offer.');
            setLoading(false);
            return;
        }

        if (userData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            setLoading(false);
            return;
        }

        const res = await register(userData);
        if (res.success) {
            redirectAfterAuth(res.role || userData.role);
        } else {
            setError(res.message || 'Registration failed. Please try again.');
        }
        setLoading(false);
    };

    const handleGoogleCredential = useCallback(async (credential) => {
        setLoading(true);
        setError('');

        if (userData.role === 'provider' && !userData.service_category) {
            setError('Please select the service you will offer.');
            setLoading(false);
            return;
        }

        const res = await loginWithGoogle(credential, {
            role: userData.role,
            city: userData.city,
            phone: userData.phone,
            service_category: userData.service_category
        });

        if (res.success) {
            redirectAfterAuth(res.role || userData.role);
        } else {
            setError(res.message || 'Google sign-in failed. Please try again.');
        }

        setLoading(false);
    }, [loginWithGoogle, redirectAfterAuth, userData]);

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-icon-circle">
                        <UserPlus size={24} />
                    </div>
                    <h2>Create Your Account</h2>
                    <p className="auth-subtitle">
                        {userData.role === 'provider'
                            ? 'Register as a service provider and start getting bookings'
                            : 'Sign up to find and book trusted service providers'
                        }
                    </p>
                </div>
                {error && <div className="error-msg">⚠️ {error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label><User size={14} /> Full Name</label>
                        <input type="text" name="name" onChange={handleChange} placeholder="e.g. Rajesh Kumar" required id="register-name" />
                    </div>
                    <div className="input-group">
                        <label><Mail size={14} /> Email Address</label>
                        <input type="email" name="email" onChange={handleChange} placeholder="you@example.com" required id="register-email" />
                    </div>
                    <div className="input-group">
                        <label><Lock size={14} /> Password</label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                onChange={handleChange}
                                placeholder="Min 8 characters"
                                required
                                minLength="8"
                                id="register-password"
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="input-group">
                        <label><Phone size={14} /> Phone Number</label>
                        <input type="tel" name="phone" onChange={handleChange} placeholder="+91 98765 43210" required id="register-phone" />
                    </div>
                    <div className="input-group">
                        <label><MapPin size={14} /> City</label>
                        <select name="city" onChange={handleChange} required value={userData.city} id="register-city">
                            <option value="">Select your city</option>
                            {indianCities.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label><Briefcase size={14} /> I am a</label>
                        <select name="role" onChange={handleChange} value={userData.role} id="register-role">
                            <option value="customer">👤 Customer — Looking for services</option>
                            <option value="provider">🔧 Service Provider — Offering services</option>
                        </select>
                    </div>

                    {/* Service Profile Section — shown only when role is 'provider' */}
                    {userData.role === 'provider' && (
                        <div className="provider-profile-section">
                            <div className="profile-section-header">
                                <Wrench size={16} />
                                <span>Service Profile</span>
                            </div>
                            <div className="input-group">
                                <label><Wrench size={14} /> What service do you offer?</label>
                                <select
                                    name="service_category"
                                    onChange={handleChange}
                                    required
                                    value={userData.service_category}
                                    id="service-category-select"
                                >
                                    <option value="">Select your service category</option>
                                    {serviceCategories.map(sc => (
                                        <option key={sc.value} value={sc.value}>{sc.label}</option>
                                    ))}
                                </select>
                            </div>
                            <p className="profile-hint">
                                You can add more services and set pricing from your dashboard after registration.
                            </p>
                        </div>
                    )}

                    <button type="submit" className="auth-btn" disabled={loading} id="register-submit">
                        {loading ? (
                            <><span className="btn-spinner"></span> Creating Account...</>
                        ) : (
                            <><UserPlus size={18} /> Create Account</>
                        )}
                    </button>
                    {hasGoogleOAuth && (
                        <>
                            <div className="auth-divider"><span>or</span></div>
                            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={loading} text="signup_with" />
                        </>
                    )}
                    <p className="auth-switch">Already have an account? <span onClick={() => navigate('/login')}>Login</span></p>
                </form>
            </div>
        </div>
    );
};

export default Register;
