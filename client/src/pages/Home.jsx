import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Shield, Clock, IndianRupee, Star, Users, ChevronRight, ArrowRight, Phone, CheckCircle, Sparkles } from 'lucide-react';
import './Home.css';

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Chandigarh', 'Kochi', 'Indore', 'Bhopal', 'Nagpur',
    'Surat', 'Vadodara', 'Noida', 'Gurgaon', 'Ghaziabad', 'Saharanpur',
];

const services = [
    { value: 'Plumber', label: 'Plumber', icon: '🔧', desc: 'Expert pipe, tap & leak repairs', img: '/images/service-plumber.png' },
    { value: 'Electrician', label: 'Electrician', icon: '⚡', desc: 'Safe wiring & appliance install', img: '/images/service-electrician.png' },
    { value: 'AC Repair', label: 'AC Repair', icon: '❄️', desc: 'Complete cooling solutions', img: '/images/service-ac-repair.png' },
    { value: 'Cleaning', label: 'Cleaning', icon: '🧹', desc: 'Deep home & office sanitization', img: '/images/service-cleaning.png' },
    { value: 'Carpenter', label: 'Carpenter', icon: '🪚', desc: 'Furniture & wood fittings', img: '/images/service-carpenter.png' },
    { value: 'Painter', label: 'Painter', icon: '🎨', desc: 'Premium interior & exterior painting', img: '/images/service-plumber.png' },
    { value: 'Driver', label: 'Driver', icon: '🚗', desc: 'Professional chauffeurs for you', img: '/images/service-driver.png' },
    { value: 'Pest Control', label: 'Pest Control', icon: '🐜', desc: 'Complete pest & insect removal', img: '/images/service-pest-control.png' },
    { value: 'Appliance Repair', label: 'Appliance Repair', icon: '⚙️', desc: 'Expert fix for all home appliances', img: '/images/service-appliance.png' },
    { value: 'Construction Labour', label: 'Construction Labour', icon: '👷', desc: 'Reliable workforce for your site', img: '/images/service-plumber.png' },
    { value: 'Mason (Mistri)', label: 'Mason (Mistri)', icon: '🧱', desc: 'Expert masonry & brickwork', img: '/images/service-plumber.png' },
];

const heroSlides = [
    '/images/hero-banner.png',
    '/images/service-plumber.png',
    '/images/service-electrician.png',
];

const Home = () => {
    const [city, setCity] = useState('');
    const [service, setService] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [stats, setStats] = useState({ providers: '20+', cities: '20+', rating: '4.9' });
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/stats/dashboard');
                if (res.ok) {
                    const data = await res.json();
                    setStats({
                        providers: data.providers + '+',
                        cities: data.cities + '+',
                        rating: data.rating
                    });
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };
        fetchStats();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % heroSlides.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    const filteredCities = indianCities.filter(c =>
        c.toLowerCase().includes(city.toLowerCase())
    );

    const handleSearch = (e) => {
        e.preventDefault();
        if (city && service) {
            navigate(`/search?city=${encodeURIComponent(city)}&service=${encodeURIComponent(service)}`);
        }
    };

    return (
        <div className="home-container">
            {/* ===== HERO ===== */}
            <section className="hero">
                <div className="hero-slideshow">
                    {heroSlides.map((src, i) => (
                        <div
                            key={i}
                            className={`hero-slide ${i === currentSlide ? 'active' : ''}`}
                            style={{ backgroundImage: `url(${src})` }}
                        />
                    ))}
                </div>
                <div className="hero-overlay"></div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="hero-content"
                >
                    <div className="hero-badge">
                        <Sparkles size={14} /> Trusted by 10,000+ homes in India
                    </div>
                    <h1>Your Premium <br /><span className="hero-highlight">Home Service Hub</span></h1>
                    <p>Expert professionals at your doorstep. Verified, punctual, and reliable services for a better living experience.</p>

                    <form className="search-box" onSubmit={handleSearch}>
                        <div className="search-input-wrapper">
                            <MapPin size={20} className="input-icon" />
                            <input
                                type="text"
                                placeholder="Select City"
                                value={city}
                                onChange={(e) => {
                                    setCity(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                className="search-input"
                                autoComplete="off"
                            />
                            <AnimatePresence>
                                {showSuggestions && city && filteredCities.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="city-suggestions"
                                    >
                                        {filteredCities.slice(0, 6).map(c => (
                                            <div key={c} className="suggestion-item" onMouseDown={() => setCity(c)}>
                                                <MapPin size={14} /> {c}
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="search-select-wrapper">
                            <Search size={20} className="input-icon" />
                            <select
                                value={service}
                                onChange={(e) => setService(e.target.value)}
                                className="search-select"
                            >
                                <option value="">What do you need?</option>
                                {services.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="search-btn">
                            Search Now
                        </button>
                    </form>

                    <div className="hero-stats">
                        <div className="stat"><Users size={16} /> <strong>{stats.providers}</strong> Experts</div>
                        <div className="stat"><Star size={16} /> <strong>{stats.rating}/5</strong> Rating</div>
                        <div className="stat"><MapPin size={16} /> <strong>{stats.cities}</strong> Cities</div>
                    </div>
                </motion.div>
            </section>

            {/* ===== HOW IT WORKS ===== */}
            <section className="how-it-works">
                <h2 className="section-title">Experience Excellence</h2>
                <p className="section-subtitle">Simplified booking process for your convenience</p>

                <div className="steps-grid">
                    {[
                        { icon: <Search />, title: "Discover", desc: "Find the best rated professionals near you instantly." },
                        { icon: <CheckCircle />, title: "Book", desc: "Schedule a time that works for you with transparent pricing." },
                        { icon: <Phone />, title: "Service", desc: "Get quality service and pay securely after completion." }
                    ].map((step, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className="step-card"
                        >
                            <div className="step-number">{i + 1}</div>
                            <div className="step-icon">{step.icon}</div>
                            <h3>{step.title}</h3>
                            <p>{step.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ===== POPULAR SERVICES ===== */}
            <section className="popular-services">
                <h2 className="section-title">Our Services</h2>
                <p className="section-subtitle">Premium solutions for all your home needs</p>
                <div className="service-grid">
                    {services.map((s, i) => (
                        <motion.div
                            key={s.value}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="service-card"
                            onClick={() => navigate(`/search?service=${encodeURIComponent(s.value)}`)}
                        >
                            <div className="service-card-img">
                                <img src={s.img} alt={s.label} />
                            </div>
                            <span className="service-icon">{s.icon}</span>
                            <h4>{s.label}</h4>
                            <p className="service-desc">{s.desc}</p>
                            <ChevronRight size={20} className="arrow-icon" />
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ===== FEATURES ===== */}
            <section className="features glass-dark">
                <h2 className="section-title">Why InServiceHub?</h2>
                <p className="section-subtitle">The gold standard in home service marketplaces</p>
                <div className="feature-grid">
                    {[
                        { icon: <Shield />, title: "Verified Pros", desc: "Multi-point background checks for your safety." },
                        { icon: <Clock />, title: "On-Time", desc: "Punctuality is our promise. 24/7 support available." },
                        { icon: <IndianRupee />, title: "Fair Pricing", desc: "Upfront quotes with no hidden surprises." },
                        { icon: <Star />, title: "Top Quality", desc: "Only the highest rated experts make the cut." }
                    ].map((feature, i) => (
                        <div key={i} className="feature-card">
                            <div className="feature-icon">{feature.icon}</div>
                            <h3>{feature.title}</h3>
                            <p>{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <h3>🏠 InServiceHub</h3>
                        <p>Elevating the standard of home services across India. Premium, professional, and purely reliable.</p>
                    </div>
                    <div className="footer-links">
                        <h4>Explore</h4>
                        <a href="/">Home</a>
                        <a href="/search">Find Services</a>
                        <a href="/register?role=provider">Join as Pro</a>
                    </div>
                    <div className="footer-links">
                        <h4>Support</h4>
                        <a href="/login">Help Center</a>
                        <a href="/privacy">Privacy Policy</a>
                        <a href="/terms">Terms of Service</a>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} InServiceHub. Crafted for Excellence.</p>
                </div>
            </footer>
        </div>
    );
};

export default Home;
