import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User, LogOut, Search, LayoutDashboard, Home, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    React.useEffect(() => {
        document.body.classList.toggle('nav-open', isOpen);
        return () => document.body.classList.remove('nav-open');
    }, [isOpen]);

    const handleLogout = () => {
        logout();
        setIsOpen(false);
        navigate('/');
    };

    const isActive = (path) => location.pathname === path;

    const handleNavClick = () => setIsOpen(false);

    return (
        <nav className={`navbar ${isOpen ? 'menu-open' : ''}`}>
            <div className="nav-container">
                <Link to="/" className="logo" onClick={handleNavClick}>
                    <span className="logo-icon">🏠</span>
                    <span className="logo-text">InServiceHub</span>
                </Link>

                <button
                    type="button"
                    className="menu-icon"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Toggle navigation menu"
                    aria-expanded={isOpen}
                    aria-controls="primary-navigation"
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                <ul id="primary-navigation" className={`nav-links ${isOpen ? 'active' : ''}`}>
                    <li>
                        <Link to="/" className={isActive('/') ? 'nav-active' : ''} onClick={handleNavClick}>
                            <Home size={16} /> Home
                        </Link>
                    </li>
                    <li>
                        <Link to="/search" className={isActive('/search') ? 'nav-active' : ''} onClick={handleNavClick}>
                            <Search size={16} /> Find Services
                        </Link>
                    </li>

                    {user ? (
                        <>
                            {user.role === 'provider' ? (
                                <li>
                                    <Link to="/provider-dashboard" className={isActive('/provider-dashboard') ? 'nav-active' : ''} onClick={handleNavClick}>
                                        <LayoutDashboard size={16} /> Dashboard
                                    </Link>
                                </li>
                            ) : (
                                <li>
                                    <Link to="/customer-dashboard" className={isActive('/customer-dashboard') ? 'nav-active' : ''} onClick={handleNavClick}>
                                        <LayoutDashboard size={16} /> My Bookings
                                    </Link>
                                </li>
                            )}
                            <li className="user-profile">
                                <Link to="/profile" className="user-info" onClick={handleNavClick}>
                                    <div className="user-avatar">
                                        {user.name?.charAt(0)?.toUpperCase()}
                                    </div>
                                    <div className="user-details">
                                        <span className="user-name">{user.name}</span>
                                        <span className="user-role">{user.role === 'provider' ? 'Provider' : 'Customer'}</span>
                                    </div>
                                </Link>
                                <button onClick={handleLogout} className="btn-logout" title="Logout">
                                    <LogOut size={16} /> Logout
                                </button>
                            </li>
                        </>
                    ) : (
                        <>
                            <li>
                                <Link to="/register?role=provider" className="nav-link-provider" onClick={handleNavClick}>
                                    <UserPlus size={16} /> Become a Provider
                                </Link>
                            </li>
                            <li>
                                <Link to="/login" className="btn-login" onClick={handleNavClick}>
                                    <User size={16} /> Login / Sign Up
                                </Link>
                            </li>
                        </>
                    )}
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
