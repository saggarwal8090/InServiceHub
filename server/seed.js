require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { initializeDatabase } = require('./db/postgres');

const seed = async () => {
    try {
        const db = await initializeDatabase();

        // Clear existing data (order matters due to foreign keys)
        await db.run('TRUNCATE reviews, bookings, services, provider_details, users RESTART IDENTITY CASCADE');

        const hashedPassword = await bcrypt.hash('password123', 10);

        // Create users with Indian cities
        const users = [
            { name: 'Rajesh Kumar', email: 'rajesh@example.com', role: 'provider', city: 'Mumbai', phone: '+91 98765 43210', is_online: 1 },
            { name: 'Priya Sharma', email: 'priya@example.com', role: 'provider', city: 'Delhi', phone: '+91 87654 32109', is_online: 0 },
            { name: 'Amit Patel', email: 'amit@example.com', role: 'provider', city: 'Ahmedabad', phone: '+91 76543 21098', is_online: 1 },
            { name: 'Suresh Reddy', email: 'suresh@example.com', role: 'provider', city: 'Hyderabad', phone: '+91 65432 10987', is_online: 1 },
            { name: 'Vikram Singh', email: 'vikram@example.com', role: 'provider', city: 'Delhi', phone: '+91 54321 09876', is_online: 1 },
            { name: 'Lakshmi Iyer', email: 'lakshmi@example.com', role: 'provider', city: 'Chennai', phone: '+91 43210 98765', is_online: 1 },
            { name: 'Anita Joshi', email: 'anita@example.com', role: 'provider', city: 'Bangalore', phone: '+91 32109 87654', is_online: 1 },
            { name: 'Mohan Das', email: 'mohan@example.com', role: 'provider', city: 'Kolkata', phone: '+91 21098 76543', is_online: 1 },
            { name: 'Deepak Verma', email: 'deepak@example.com', role: 'provider', city: 'Pune', phone: '+91 99001 12233', is_online: 0 },
            { name: 'Kavita Nair', email: 'kavita@example.com', role: 'provider', city: 'Kochi', phone: '+91 88112 23344', is_online: 1 },
            { name: 'Ravi Gupta', email: 'ravi@example.com', role: 'provider', city: 'Jaipur', phone: '+91 77223 34455', is_online: 1 },
            { name: 'Sunita Devi', email: 'sunita@example.com', role: 'provider', city: 'Lucknow', phone: '+91 66334 45566', is_online: 0 },
            { name: 'Arjun Mehta', email: 'arjun@example.com', role: 'provider', city: 'Mumbai', phone: '+91 55445 56677', is_online: 1 },
            { name: 'Pooja Tiwari', email: 'pooja@example.com', role: 'provider', city: 'Indore', phone: '+91 44556 67788', is_online: 1 },
            { name: 'Sanjay Mishra', email: 'sanjay@example.com', role: 'provider', city: 'Noida', phone: '+91 33667 78899', is_online: 1 },
            { name: 'Meena Kumari', email: 'meena@example.com', role: 'provider', city: 'Chandigarh', phone: '+91 22778 89900', is_online: 1 },
            { name: 'Rohit Saxena', email: 'rohit@example.com', role: 'provider', city: 'Bhopal', phone: '+91 11889 90011', is_online: 1 },
            { name: 'Neha Kapoor', email: 'neha@example.com', role: 'provider', city: 'Gurgaon', phone: '+91 99990 01122', is_online: 1 },
            { name: 'Anil Yadav', email: 'anil@example.com', role: 'provider', city: 'Nagpur', phone: '+91 88001 12233', is_online: 0 },
            { name: 'Geeta Deshpande', email: 'geeta@example.com', role: 'provider', city: 'Surat', phone: '+91 77112 23344', is_online: 1 },
            // Customers
            { name: 'Ankit Sharma', email: 'ankit@example.com', role: 'customer', city: 'Mumbai', phone: '+91 99887 76655', is_online: 1 },
            { name: 'Sneha Patel', email: 'sneha@example.com', role: 'customer', city: 'Pune', phone: '+91 88776 65544', is_online: 1 },
            { name: 'Rahul Verma', email: 'rahul@example.com', role: 'customer', city: 'Delhi', phone: '+91 77665 54433', is_online: 1 },
            { name: 'Divya Gupta', email: 'divya@example.com', role: 'customer', city: 'Bangalore', phone: '+91 66554 43322', is_online: 1 },
            { name: 'Varun Nair', email: 'varun@example.com', role: 'customer', city: 'Kochi', phone: '+91 55443 32211', is_online: 1 },
        ];

        for (const user of users) {
            const result = await db.get(
                'INSERT INTO users (name, email, password, role, city, phone, is_online) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
                [user.name, user.email, hashedPassword, user.role, user.city, user.phone, Boolean(user.is_online)]
            );
            user.id = result.id;
        }

        // Provider details with service_category and services
        const providerServices = [
            { email: 'rajesh@example.com', service: 'Plumber', category: 'Plumbing', price: 500, experience: 5 },
            { email: 'priya@example.com', service: 'Electrician', category: 'Electrical', price: 400, experience: 3 },
            { email: 'amit@example.com', service: 'Carpenter', category: 'Carpentry', price: 650, experience: 8 },
            { email: 'suresh@example.com', service: 'Plumber', category: 'Plumbing', price: 550, experience: 6 },
            { email: 'vikram@example.com', service: 'AC Repair', category: 'AC & Appliance Repair', price: 800, experience: 10 },
            { email: 'lakshmi@example.com', service: 'Cleaning', category: 'Cleaning & Pest Control', price: 350, experience: 4 },
            { email: 'anita@example.com', service: 'Electrician', category: 'Electrical', price: 450, experience: 5 },
            { email: 'mohan@example.com', service: 'Plumber', category: 'Plumbing', price: 400, experience: 12 },
            { email: 'deepak@example.com', service: 'Painter', category: 'Painting', price: 600, experience: 7 },
            { email: 'kavita@example.com', service: 'AC Repair', category: 'AC & Appliance Repair', price: 700, experience: 6 },
            { email: 'ravi@example.com', service: 'Pest Control', category: 'Cleaning & Pest Control', price: 900, experience: 9 },
            { email: 'sunita@example.com', service: 'Cleaning', category: 'Cleaning & Pest Control', price: 300, experience: 3 },
            { email: 'arjun@example.com', service: 'Appliance Repair', category: 'AC & Appliance Repair', price: 750, experience: 8 },
            { email: 'pooja@example.com', service: 'Carpenter', category: 'Carpentry', price: 500, experience: 5 },
            { email: 'sanjay@example.com', service: 'Painter', category: 'Painting', price: 550, experience: 11 },
            { email: 'meena@example.com', service: 'Driver', category: 'Driving', price: 1200, experience: 15 },
            { email: 'rohit@example.com', service: 'Construction Labour', category: 'Construction', price: 450, experience: 7 },
            { email: 'neha@example.com', service: 'Mason (Mistri)', category: 'Construction', price: 800, experience: 10 },
            { email: 'anil@example.com', service: 'Driver', category: 'Driving', price: 1000, experience: 12 },
            { email: 'geeta@example.com', service: 'Construction Labour', category: 'Construction', price: 500, experience: 6 },
        ];

        const providers = users.filter(u => u.role === 'provider');
        for (const p of providers) {
            const svc = providerServices.find(s => s.email === p.email);
            if (!svc) continue;

            const rating = (Math.random() * 1.5 + 3.5).toFixed(1);
            const reviews = Math.floor(Math.random() * 200) + 20;

            await db.run(
                'INSERT INTO provider_details (user_id, service_category, experience, description, rating, total_reviews, verified) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [p.id, svc.category, svc.experience, `Experienced ${svc.service} professional in ${p.city}`, rating, reviews, true]
            );

            await db.run(
                'INSERT INTO services (provider_id, service_name, category, price) VALUES (?, ?, ?, ?)',
                [p.id, svc.service, svc.category, svc.price]
            );
        }

        // Create a few sample bookings
        const customers = users.filter(u => u.role === 'customer');
        const services = await db.all('SELECT * FROM services LIMIT 5');

        for (let i = 0; i < Math.min(5, services.length); i++) {
            const customer = customers[i % customers.length];
            const svc = services[i];
            await db.run(
                'INSERT INTO bookings (customer_id, provider_id, service_id, date, time, address, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    customer.id,
                    svc.provider_id,
                    svc.id,
                    '2026-03-15',
                    '10:00',
                    `${customer.city}, India`,
                    `Need ${svc.service_name} service at home`,
                    i < 2 ? 'completed' : 'pending'
                ]
            );
        }

        // Add reviews for completed bookings
        const completedBookings = await db.all("SELECT * FROM bookings WHERE status = 'completed'");
        for (const booking of completedBookings) {
            await db.run(
                'INSERT INTO reviews (booking_id, rating, comment) VALUES (?, ?, ?)',
                [booking.id, Math.floor(Math.random() * 2) + 4, 'Great service, very professional and on time!']
            );
        }

        console.log('');
        console.log('✅ Database seeded successfully!');
        console.log(`   - ${providers.length} providers across 20 Indian cities`);
        console.log(`   - ${customers.length} customers created`);
        console.log(`   - ${completedBookings.length} bookings with reviews`);
        console.log('');
        console.log('🔑 Login credentials:');
        console.log('   Email: Any user email (e.g., rajesh@example.com, ankit@example.com)');
        console.log('   Password: password123');
        console.log('');

        await db.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding database:', err);
        process.exit(1);
    }
};

seed();
