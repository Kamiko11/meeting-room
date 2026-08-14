require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { connectDB, Booking } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password — change this in production or set via environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

/**
 * Middleware: verify admin password from Authorization header.
 * Expects header: Authorization: Bearer <admin_password>
 */
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ Admin' });
    }
    const token = authHeader.slice(7);
    if (token !== ADMIN_PASSWORD) {
        return res.status(403).json({ success: false, message: 'รหัสผ่าน Admin ไม่ถูกต้อง' });
    }
    next();
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

/**
 * GET /api/bookings
 * Returns all active bookings for calendar display
 */
app.get('/api/bookings', async (req, res, next) => {
    try {
        const bookings = await Booking.find({ status: 'active' }).sort({ booking_date: 1, start_time: 1 });
        const events = bookings.map(booking => ({
            id: booking._id,
            title: "จองโดย: " + booking.full_name,
            start: booking.booking_date + "T" + booking.start_time,
            end: booking.booking_date + "T" + booking.end_time,
            extendedProps: {
                fullName: booking.full_name,
                faculty: booking.faculty,
                purpose: booking.purpose,
                bookingDate: booking.booking_date,
                startTime: booking.start_time,
                endTime: booking.end_time
            }
        }));
        res.json(events);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/bookings/:date
 * Returns active bookings for a specific date
 */
app.get('/api/bookings/:date', async (req, res, next) => {
    try {
        const { date } = req.params;
        const bookings = await Booking.find({ status: 'active', booking_date: date })
            .sort({ start_time: 1 })
            .select('-cancel_pin')
            .lean();
            
        // Map _id to id for frontend compatibility
        const formattedBookings = bookings.map(b => ({ ...b, id: b._id }));
        res.json(formattedBookings);
    } catch (err) {
        next(err);
    }
});

// Helper function to parse HH:mm into total minutes for easier calculation
const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

/**
 * POST /api/bookings
 * Create a new booking
 */
app.post('/api/bookings', async (req, res, next) => {
    try {
        const { fullName, faculty, bookingDate, startTime, endTime, purpose } = req.body;
        
        // 1. All fields required
        if (!fullName || !faculty || !bookingDate || !startTime || !endTime || !purpose) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        // Time validation logic
        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(endTime);
        const openMins = timeToMinutes('08:30');
        const closeMins = timeToMinutes('16:30');
        
        // 2. Service hours check
        if (startMins < openMins || endMins > closeMins) {
            return res.status(400).json({ success: false, message: 'เวลาให้บริการคือ 08:30 ถึง 16:30' });
        }
        
        // 3. Start time before end time
        if (startMins >= endMins) {
            return res.status(400).json({ success: false, message: 'เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด' });
        }
        
        const duration = endMins - startMins;
        
        // 4. Minimum duration 30 minutes
        if (duration < 30) {
            return res.status(400).json({ success: false, message: 'ต้องจองอย่างน้อย 30 นาที' });
        }
        
        // No maximum duration limit as long as it's within operating hours (checked above)

        // 6. Check overlap
        const overlaps = await Booking.find({
            status: 'active',
            booking_date: bookingDate,
            start_time: { $lt: endTime },
            end_time: { $gt: startTime }
        });

        if (overlaps.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'จองไม่สำเร็จ เนื่องจากมีผู้จองแล้วในช่วงเวลานี้',
                conflicts: overlaps
            });
        }
        
        // Create random 6-digit PIN (100000-999999)
        const plainPin = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash the PIN with bcryptjs (salt rounds 10)
        const salt = await bcrypt.genSalt(10);
        const cancelPinHash = await bcrypt.hash(plainPin, salt);
        
        // Save to database
        const newBooking = new Booking({
            full_name: fullName,
            faculty: faculty,
            booking_date: bookingDate,
            start_time: startTime,
            end_time: endTime,
            purpose: purpose,
            cancel_pin: cancelPinHash
        });

        await newBooking.save();
        
        const bookingResponse = newBooking.toObject();
        bookingResponse.id = bookingResponse._id; // Mapping for frontend
        delete bookingResponse.cancel_pin; // Remove pin before sending back

        // Return 201 with booking info and plain PIN
        res.status(201).json({
            success: true,
            message: 'จองสำเร็จ',
            booking: bookingResponse,
            cancelPin: plainPin
        });
        
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/bookings/:id/cancel
 * Cancel an existing booking
 */
app.post('/api/bookings/:id/cancel', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { pin } = req.body;
        
        if (!pin) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ PIN' });
        }
        
        const booking = await Booking.findOne({ _id: id, status: 'active' });
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือถูกยกเลิกไปแล้ว' });
        }
        
        const isMatch = await bcrypt.compare(pin, booking.cancel_pin);
        
        if (!isMatch) {
            return res.status(403).json({ success: false, message: 'รหัส PIN ไม่ถูกต้อง' });
        }
        
        // Delete booking from database
        await Booking.deleteOne({ _id: id });
        
        res.json({ success: true, message: 'ยกเลิกการจองสำเร็จ' });
    } catch (err) {
        next(err);
    }
});

// ============================================================
//  ADMIN API ROUTES
// ============================================================

/**
 * POST /api/admin/login
 * Verify admin password. Returns success if correct.
 */
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ' });
    } else {
        res.status(403).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }
});

/**
 * GET /api/admin/bookings
 * Returns ALL bookings (active + cancelled) for admin dashboard.
 */
app.get('/api/admin/bookings', requireAdmin, async (req, res, next) => {
    try {
        const bookings = await Booking.find()
            .sort({ created_at: -1 })
            .select('-cancel_pin')
            .lean();
            
        // Map _id to id for frontend compatibility
        const formattedBookings = bookings.map(b => ({ ...b, id: b._id }));
        res.json({ success: true, bookings: formattedBookings });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/bookings/:id/force-cancel
 * Admin force cancel — no PIN required.
 */
app.post('/api/admin/bookings/:id/force-cancel', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const booking = await Booking.findOne({ _id: id, status: 'active' });
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือถูกยกเลิกไปแล้ว' });
        }
        
        booking.status = 'cancelled';
        booking.cancelled_at = new Date();
        await booking.save();
        
        res.json({ success: true, message: 'ยกเลิกการจองสำเร็จ' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/bookings/:id/reset-pin
 * Generate new 6-digit PIN, hash it, store it, return the plain PIN.
 */
app.post('/api/admin/bookings/:id/reset-pin', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findOne({ _id: id, status: 'active' });
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือถูกยกเลิกไปแล้ว' });
        }

        // Generate new 6-digit PIN
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash with bcrypt
        const salt = await bcrypt.genSalt(10);
        const newPinHash = await bcrypt.hash(newPin, salt);

        // Save to database
        booking.cancel_pin = newPinHash;
        await booking.save();

        res.json({ success: true, message: 'รีเซ็ต PIN สำเร็จ', newPin });
    } catch (err) {
        next(err);
    }
});

// Global error handler middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
});

// Start the server after initializing the database
async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
