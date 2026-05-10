import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ProviderCard from '../components/ProviderCard';
import BookingModal from '../components/BookingModal';
import { MapPin, Filter, Send, Users } from 'lucide-react';
import './Search.css';

const indianCities = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Chandigarh', 'Kochi', 'Indore', 'Bhopal', 'Nagpur',
    'Surat', 'Vadodara', 'Noida', 'Gurgaon', 'Ghaziabad'
];

const Search = () => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingProvider, setBookingProvider] = useState(null);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [filters, setFilters] = useState({
        city: '',
        service: '',
        online: false,
        rating: 0,
        priceRange: [0, 5000]
    });

    const location = useLocation();
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const city = params.get('city') || '';
        const service = params.get('service') || '';

        setFilters(prev => ({ ...prev, city, service }));
        fetchProviders(city, service);
    }, [location.search]);

    const fetchProviders = async (city, service, online = false) => {
        setLoading(true);
        try {
            const API_URL = import.meta.env.VITE_API_URL || '/api';
            const query = new URLSearchParams({
                city,
                service,
                online
            }).toString();

            const response = await fetch(`${API_URL}/providers?${query}`);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setProviders(data);
        } catch (error) {
            console.error('Error fetching providers:', error);
            setProviders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newVal = type === 'checkbox' ? checked : value;
        setFilters(prev => {
            const createNew = { ...prev, [name]: newVal };
            fetchProviders(createNew.city, createNew.service, createNew.online);
            return createNew;
        });
    };

    const selectCity = (c) => {
        setFilters(prev => ({ ...prev, city: c }));
        setShowCitySuggestions(false);
        fetchProviders(c, filters.service, filters.online);
    };

    const filteredCities = indianCities.filter(c =>
        c.toLowerCase().includes(filters.city.toLowerCase())
    );

    // Broadcast: open booking modal with no specific provider ID
    const handleBroadcastBook = () => {
        setBookingProvider({
            // No id → BookingModal will use broadcast mode
            service_name: filters.service,
            city: filters.city
        });
    };

    return (
        <div className="search-page">
            <div className="sidebar">
                <h3><Filter size={18} /> Filters</h3>
                <div className="filter-group">
                    <label><MapPin size={14} /> City</label>
                    <div className="city-input-wrapper">
                        <input
                            type="text"
                            name="city"
                            value={filters.city}
                            onChange={(e) => {
                                handleFilterChange(e);
                                setShowCitySuggestions(true);
                            }}
                            onFocus={() => setShowCitySuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                            placeholder="e.g. Mumbai, Delhi"
                            autoComplete="off"
                        />
                        {showCitySuggestions && filters.city && filteredCities.length > 0 && (
                            <div className="city-suggestions">
                                {filteredCities.slice(0, 6).map(c => (
                                    <div key={c} className="suggestion-item" onMouseDown={() => selectCity(c)}>
                                        <MapPin size={12} /> {c}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="filter-group">
                    <label>Service Category</label>
                    <select name="service" value={filters.service} onChange={handleFilterChange}>
                        <option value="">All Services</option>
                        <option value="Plumber">🔧 Plumber</option>
                        <option value="Electrician">⚡ Electrician</option>
                        <option value="AC Repair">❄️ AC Repair</option>
                        <option value="Cleaning">🧹 Cleaning</option>
                        <option value="Carpenter">🪚 Carpenter</option>
                        <option value="Painter">🎨 Painter</option>
                        <option value="Driver">🚗 Driver</option>
                        <option value="Pest Control">🐜 Pest Control</option>
                        <option value="Appliance Repair">⚙️ Appliance Repair</option>
                        <option value="Construction Labour">👷 Construction Labour</option>
                        <option value="Mason (Mistri)">🧱 Mason (Mistri)</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            name="online"
                            checked={filters.online}
                            onChange={handleFilterChange}
                        />
                        Online Providers Only
                    </label>
                </div>
            </div>

            <div className="results-container">
                <h2>{filters.service || 'Service'} Providers in {filters.city || 'all cities'}</h2>
                <p className="results-count">{providers.length} provider{providers.length !== 1 ? 's' : ''} found</p>

                {/* ======= BROADCAST CARD — "Any Available" option ======= */}
                {filters.city && filters.service && !loading && (
                    <div className="broadcast-card" onClick={handleBroadcastBook}>
                        <div className="broadcast-card-icon">
                            <Send size={28} />
                        </div>
                        <div className="broadcast-card-content">
                            <h3>Request Any Available {filters.service}</h3>
                            <p>Send your request to <strong>all {filters.service} providers in {filters.city}</strong>. The first one to accept will be assigned to you.</p>
                            <div className="broadcast-card-meta">
                                <span><Users size={14} /> {providers.length} providers available</span>
                                <span className="broadcast-card-tag">Fastest Response</span>
                            </div>
                        </div>
                        <button className="broadcast-card-btn">
                            <Send size={16} /> Request Now
                        </button>
                    </div>
                )}

                {/* ======= Divider ======= */}
                {filters.city && filters.service && !loading && providers.length > 0 && (
                    <div className="or-divider">
                        <span>OR choose a specific provider</span>
                    </div>
                )}

                {/* ======= Individual Provider Cards ======= */}
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Finding the best providers...</p>
                    </div>
                ) : (
                    <div className="providers-grid">
                        {providers.length > 0 ? providers.map(p => (
                            <ProviderCard key={p.id} provider={p} onBook={(provider) => setBookingProvider(provider)} />
                        )) : (
                            <div className="no-results">
                                <MapPin size={48} color="#ccc" />
                                <p>No providers found matching your criteria.</p>
                                <span>Try adjusting your filters or searching in a different city.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {bookingProvider && (
                <BookingModal
                    provider={bookingProvider}
                    onClose={() => setBookingProvider(null)}
                    onSuccess={() => { }}
                />
            )}
        </div>
    );
};

export default Search;
