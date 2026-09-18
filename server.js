require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, Booking } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password — change this in production or set via environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

// Google Apps Script Web App URL สำหรับส่งอีเมล
const GAS_EMAIL_URL = 'https://script.google.com/macros/s/AKfycbxyvqQJg3nMsJ9IopP0S-nQcwMA6WUkipYGZFSNr9d4EOtojEgqwpvOqie2CXoyX8mR0w/exec';

/**
 * ฟังก์ชันหลักสำหรับเรียก Google Apps Script API เพื่อส่งอีเมล
 */
async function sendEmail(to, subject, htmlContent) {
    try {
        const response = await fetch(GAS_EMAIL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: to,
                subject: subject,
                html: htmlContent,
                senderName: "ระบบจองห้องประชุม มศว"
            })
        });
        
        const result = await response.json();
        if (!result.success) {
            console.error('GAS Email Error:', result.error);
        } else {
            console.log(`[Email Success] ส่งอีเมลสำเร็จไปยัง: ${to}`);
        }
    } catch (err) {
        console.error('Exception in sendEmail:', err.message);
    }
}

/**
 * Format date string (YYYY-MM-DD) to Thai date format
 */
function formatDateThaiServer(dateStr) {
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                     'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${months[m - 1]} ${y + 543}`;
}

/**
 * Send email notification to student about booking status
 */
async function sendEmailNotification(booking, type) {
    const dateThai = formatDateThaiServer(booking.booking_date);
    const timeRange = `${booking.start_time} - ${booking.end_time} น.`;

    let subject, statusIcon, statusText, statusColor, extraMessage;

    switch (type) {
        case 'approved':
            subject = '✅ การจองห้องประชุมได้รับการอนุมัติ';
            statusIcon = '✅';
            statusText = 'อนุมัติแล้ว';
            statusColor = '#2E7D32';
            extraMessage = 'กรุณามาตามวันและเวลาที่จองไว้';
            break;
        case 'rejected':
            subject = '❌ การจองห้องประชุมถูกปฏิเสธ';
            statusIcon = '❌';
            statusText = 'ถูกปฏิเสธ';
            statusColor = '#C62828';
            extraMessage = booking.admin_note ? `เหตุผล: ${booking.admin_note}` : 'หากมีข้อสงสัย กรุณาติดต่อสำนักคอมพิวเตอร์';
            break;
        case 'cancelled':
            subject = '🚫 การจองห้องประชุมถูกยกเลิก';
            statusIcon = '🚫';
            statusText = 'ถูกยกเลิก';
            statusColor = '#E65100';
            extraMessage = 'หากมีข้อสงสัย กรุณาติดต่อสำนักคอมพิวเตอร์';
            break;
        default:
            return;
    }

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #8B1A1A, #6d1515); padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 18px;">🏢 ระบบจองห้องประชุม</h2>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">สำนักคอมพิวเตอร์ มศว องครักษ์</p>
        </div>
        <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #333;">สวัสดี คุณ<strong>${booking.full_name}</strong></p>
            <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 48px;">${statusIcon}</span>
                <h3 style="color: ${statusColor}; margin: 8px 0;">${subject}</h3>
            </div>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; color: #666; width: 120px;">📅 วันที่</td><td style="padding: 8px 0; font-weight: 600;">${dateThai}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">⏰ เวลา</td><td style="padding: 8px 0; font-weight: 600;">${timeRange}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📋 คณะ</td><td style="padding: 8px 0;">${booking.faculty}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📌 วัตถุประสงค์</td><td style="padding: 8px 0;">${booking.purpose}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📊 สถานะ</td><td style="padding: 8px 0;"><span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px;">${statusText}</span></td></tr>
                </table>
            </div>
            <p style="color: #666; font-size: 14px;">${extraMessage}</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; font-size: 13px; color: #666; line-height: 1.5;">
            <p style="margin: 0; font-weight: bold; color: #333;">สำนักคอมพิวเตอร์ มศว องครักษ์ จ.นครนายก</p>
            <p style="margin: 4px 0;">📍 ชั้น 3 อาคารเรียนรวม<br>63 หมู่ 7 ถนนรังสิต-นครนายก คลอง16 ตำบลองครักษ์ อำเภอองครักษ์ จังหวัดนครนายก 26120</p>
            <p style="margin: 4px 0;">📞 ติดต่อสำนักงาน: โทรศัพท์ 0 2649 5000 ต่อ 27419<br>✉️ อีเมล: saraban_cc@g.swu.ac.th</p>
        </div>
    </div>`;

    await sendEmail(booking.email, `${subject} - ระบบจองห้องประชุม มศว`, htmlContent);
}

/**
 * Send email to admin when a new booking is submitted
 */
async function sendAdminNewBookingEmail(booking) {
    if (!ADMIN_EMAIL) return;

    const dateThai = formatDateThaiServer(booking.booking_date);
    const timeRange = `${booking.start_time} - ${booking.end_time} น.`;

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #ff9800, #f57c00); padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 18px;">📬 มีคำขอจองห้องประชุมใหม่!</h2>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 14px;">ระบบจองห้องประชุม สำนักคอมพิวเตอร์ มศว องครักษ์</p>
        </div>
        <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #333;">มีผู้ส่งคำขอจองห้องประชุมใหม่ กรุณาตรวจสอบและดำเนินการ</p>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; color: #666; width: 120px;">👤 ชื่อผู้จอง</td><td style="padding: 8px 0; font-weight: 600;">${booking.full_name}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📅 วันที่</td><td style="padding: 8px 0; font-weight: 600;">${dateThai}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">⏰ เวลา</td><td style="padding: 8px 0; font-weight: 600;">${timeRange}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📋 คณะ</td><td style="padding: 8px 0;">${booking.faculty}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📧 อีเมล</td><td style="padding: 8px 0;">${booking.email}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📞 โทร</td><td style="padding: 8px 0;">${booking.phone}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📌 วัตถุประสงค์</td><td style="padding: 8px 0;">${booking.purpose}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📊 สถานะ</td><td style="padding: 8px 0;"><span style="background: #ff9800; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px;">รออนุมัติ</span></td></tr>
                </table>
            </div>
            <p style="color: #666; font-size: 14px;">กรุณาเข้าสู่ระบบ Admin Dashboard เพื่ออนุมัติหรือปฏิเสธคำขอนี้</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; font-size: 13px; color: #666; line-height: 1.5;">
            <p style="margin: 0; font-weight: bold; color: #333;">สำนักคอมพิวเตอร์ มศว องครักษ์ จ.นครนายก</p>
            <p style="margin: 4px 0;">📍 ชั้น 3 อาคารเรียนรวม<br>63 หมู่ 7 ถนนรังสิต-นครนายก คลอง16 ตำบลองครักษ์ อำเภอองครักษ์ จังหวัดนครนายก 26120</p>
            <p style="margin: 4px 0;">📞 ติดต่อสำนักงาน: โทรศัพท์ 0 2649 5000 ต่อ 27419<br>✉️ อีเมล: saraban_cc@g.swu.ac.th</p>
        </div>
    </div>`;

    await sendEmail(ADMIN_EMAIL, `📬 คำขอจองใหม่ - ${booking.full_name} (${dateThai})`, htmlContent);
}

/**
 * Send confirmation email to booker when booking is submitted
 */
async function sendBookerConfirmationEmail(booking) {
    const dateThai = formatDateThaiServer(booking.booking_date);
    const timeRange = `${booking.start_time} - ${booking.end_time} น.`;

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #8B1A1A, #6d1515); padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 18px;">🏢 ระบบจองห้องประชุม</h2>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">สำนักคอมพิวเตอร์ มศว องครักษ์</p>
        </div>
        <div style="padding: 32px 24px;">
            <p style="font-size: 16px; color: #333;">สวัสดี คุณ<strong>${booking.full_name}</strong></p>
            <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 48px;">📩</span>
                <h3 style="color: #1565c0; margin: 8px 0;">ระบบได้รับคำขอจองของคุณแล้ว</h3>
            </div>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; color: #666; width: 120px;">📅 วันที่</td><td style="padding: 8px 0; font-weight: 600;">${dateThai}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">⏰ เวลา</td><td style="padding: 8px 0; font-weight: 600;">${timeRange}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📋 คณะ</td><td style="padding: 8px 0;">${booking.faculty}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📌 วัตถุประสงค์</td><td style="padding: 8px 0;">${booking.purpose}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">📊 สถานะ</td><td style="padding: 8px 0;"><span style="background: #ff9800; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px;">⏳ รออนุมัติ</span></td></tr>
                </table>
            </div>
            <p style="color: #666; font-size: 14px;">คำขอจองของคุณอยู่ระหว่างรอการอนุมัติจากเจ้าหน้าที่ เมื่อมีการอนุมัติหรือปฏิเสธ ระบบจะแจ้งผลให้คุณทราบทางอีเมลอีกครั้ง</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; font-size: 13px; color: #666; line-height: 1.5;">
            <p style="margin: 0; font-weight: bold; color: #333;">สำนักคอมพิวเตอร์ มศว องครักษ์ จ.นครนายก</p>
            <p style="margin: 4px 0;">📍 ชั้น 3 อาคารเรียนรวม<br>63 หมู่ 7 ถนนรังสิต-นครนายก คลอง16 ตำบลองครักษ์ อำเภอองครักษ์ จังหวัดนครนายก 26120</p>
            <p style="margin: 4px 0;">📞 ติดต่อสำนักงาน: โทรศัพท์ 0 2649 5000 ต่อ 27419<br>✉️ อีเมล: saraban_cc@g.swu.ac.th</p>
        </div>
    </div>`;

    await sendEmail(booking.email, `📩 ได้รับคำขอจองห้องประชุมแล้ว - ระบบจองห้องประชุม มศว`, htmlContent);
}

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
 * Email validation: allow @g.swu.ac.th and specific test email
 */
function isValidEmail(email) {
    const swuRegex = /^[a-zA-Z0-9._%+\-]+@g\.swu\.ac\.th$/;
    const testEmail = 'aom3222ad@gmail.com';
    return swuRegex.test(email) || email.toLowerCase() === testEmail;
}

// ============================================================
//  OTP STORE (in-memory, 5-minute expiry)
// ============================================================
const otpStore = new Map(); // key: email, value: { code, bookingId, expiresAt }

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanExpiredOTPs() {
    const now = Date.now();
    for (const [key, val] of otpStore) {
        if (val.expiresAt < now) otpStore.delete(key);
    }
}

// ============================================================
//  SELF-SERVICE CANCELLATION API ROUTES
// ============================================================

/**
 * POST /api/my-bookings
 * Search bookings by email. Returns active bookings (pending/approved).
 */
app.post('/api/my-bookings', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกอีเมลมหาวิทยาลัย (@g.swu.ac.th) ที่ถูกต้อง' });
        }

        const bookings = await Booking.find({
            email: email.toLowerCase(),
            status: { $in: ['pending', 'approved'] }
        }).sort({ booking_date: 1, start_time: 1 }).lean();

        const formatted = bookings.map(b => ({
            id: b._id,
            full_name: b.full_name,
            faculty: b.faculty,
            booking_date: b.booking_date,
            start_time: b.start_time,
            end_time: b.end_time,
            purpose: b.purpose,
            status: b.status
        }));

        res.json({ success: true, bookings: formatted });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/request-cancel-otp
 * Send OTP to the user's email for booking cancellation verification.
 */
app.post('/api/request-cancel-otp', async (req, res, next) => {
    try {
        const { email, bookingId } = req.body;
        if (!email || !bookingId) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
        }

        // Verify the booking exists and belongs to this email
        const booking = await Booking.findOne({
            _id: bookingId,
            email: email.toLowerCase(),
            status: { $in: ['pending', 'approved'] }
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้' });
        }

        // Rate limit: 1 OTP per email per 60 seconds
        cleanExpiredOTPs();
        const existing = otpStore.get(email.toLowerCase());
        if (existing && (existing.expiresAt - Date.now()) > 4 * 60 * 1000) {
            return res.status(429).json({ success: false, message: 'กรุณารอ 1 นาทีก่อนขอรหัส OTP ใหม่' });
        }

        const otp = generateOTP();
        otpStore.set(email.toLowerCase(), {
            code: otp,
            bookingId: bookingId,
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
        });

        // Send OTP email
        const dateThai = formatDateThaiServer(booking.booking_date);
        const timeRange = `${booking.start_time} - ${booking.end_time} น.`;

        const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #e65100, #ff9800); padding: 24px; text-align: center;">
                <h2 style="color: white; margin: 0; font-size: 18px;">🔐 รหัส OTP ยืนยันการยกเลิกจอง</h2>
                <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 14px;">ระบบจองห้องประชุม สำนักคอมพิวเตอร์ มศว องครักษ์</p>
            </div>
            <div style="padding: 32px 24px;">
                <p style="font-size: 16px; color: #333;">สวัสดี คุณ<strong>${booking.full_name}</strong></p>
                <p style="color: #666;">คุณได้ขอยกเลิกการจองห้องประชุม โปรดใช้รหัส OTP ด้านล่างเพื่อยืนยัน:</p>
                <div style="text-align: center; margin: 24px 0;">
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #e65100; background: #fff3e0; border: 2px dashed #ff9800; padding: 16px 32px; border-radius: 12px; display: inline-block;">${otp}</div>
                    <p style="color: #999; font-size: 13px; margin-top: 8px;">รหัสนี้จะหมดอายุใน 5 นาที</p>
                </div>
                <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 0 0 8px; font-weight: 600; color: #333;">📋 รายการจองที่ต้องการยกเลิก:</p>
                    <p style="margin: 4px 0; color: #666;">📅 วันที่: <strong>${dateThai}</strong></p>
                    <p style="margin: 4px 0; color: #666;">⏰ เวลา: <strong>${timeRange}</strong></p>
                    <p style="margin: 4px 0; color: #666;">📌 วัตถุประสงค์: ${booking.purpose}</p>
                </div>
                <p style="color: #c62828; font-size: 13px;">⚠️ หากคุณไม่ได้ขอยกเลิกการจอง กรุณาเพิกเฉยอีเมลนี้</p>
            </div>
            <div style="background: #f5f5f5; padding: 16px 24px; text-align: center; font-size: 13px; color: #666;">
                <p style="margin: 0;">สำนักคอมพิวเตอร์ มศว องครักษ์ | โทร 0 2649 5000 ต่อ 27419</p>
            </div>
        </div>`;

        sendEmail(email, '🔐 รหัส OTP ยืนยันการยกเลิกจอง - ระบบจองห้องประชุม มศว', htmlContent);

        res.json({ success: true, message: 'ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/cancel-with-otp
 * Cancel a booking after verifying OTP.
 */
app.post('/api/cancel-with-otp', async (req, res, next) => {
    try {
        const { email, bookingId, otp } = req.body;
        if (!email || !bookingId || !otp) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
        }

        cleanExpiredOTPs();
        const stored = otpStore.get(email.toLowerCase());

        if (!stored) {
            return res.status(400).json({ success: false, message: 'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่' });
        }

        if (stored.code !== otp || stored.bookingId !== bookingId) {
            return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง' });
        }

        // OTP is valid, cancel the booking
        const booking = await Booking.findOneAndUpdate(
            { _id: bookingId, email: email.toLowerCase(), status: { $in: ['pending', 'approved'] } },
            { status: 'cancelled', cancelled_at: new Date(), admin_note: 'ยกเลิกโดยนิสิตเอง' },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือถูกยกเลิกไปแล้ว' });
        }

        // Delete used OTP
        otpStore.delete(email.toLowerCase());

        // Send cancellation notification email
        sendEmailNotification(booking, 'cancelled');

        res.json({ success: true, message: 'ยกเลิกการจองเรียบร้อยแล้ว' });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/bookings
 * Returns all active bookings for calendar display
 */
app.get('/api/bookings', async (req, res, next) => {
    try {
        const bookings = await Booking.find({ status: { $in: ['pending', 'approved'] } }).sort({ booking_date: 1, start_time: 1 });
        const events = bookings.map(booking => {
            const isPending = booking.status === 'pending';
            return {
                id: booking._id,
                title: isPending ? "รอนุมัติ: " + booking.full_name : "จองโดย: " + booking.full_name,
                start: booking.booking_date + "T" + booking.start_time,
                end: booking.booking_date + "T" + booking.end_time,
                color: isPending ? '#ff9800' : '#1565c0',
                extendedProps: {
                    fullName: booking.full_name,
                    faculty: booking.faculty,
                    purpose: booking.purpose,
                    bookingDate: booking.booking_date,
                    startTime: booking.start_time,
                    endTime: booking.end_time,
                    status: booking.status
                }
            };
        });
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
        const bookings = await Booking.find({ status: { $in: ['pending', 'approved'] }, booking_date: date })
            .sort({ start_time: 1 })
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
        const { fullName, faculty, email, phone, bookingDate, startTime, endTime, purpose } = req.body;
        
        // 1. All fields required
        if (!fullName || !faculty || !email || !phone || !bookingDate || !startTime || !endTime || !purpose) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
        }

        // Validate email format - only @g.swu.ac.th or test email allowed
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'กรุณาใช้อีเมลมหาวิทยาลัย (@g.swu.ac.th) เท่านั้น' });
        }

        // Validate phone format (Thai phone: 10 digits starting with 0)
        const phoneClean = phone.replace(/[-\s]/g, '');
        if (!/^0\d{8,9}$/.test(phoneClean)) {
            return res.status(400).json({ success: false, message: 'รูปแบบเบอร์โทรไม่ถูกต้อง (เช่น 0812345678)' });
        }
        
        // Time validation logic
        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(endTime);
        const openMins = timeToMinutes('08:30');
        const closeMins = timeToMinutes('18:30');
        
        // 2. Service hours check
        if (startMins < openMins || endMins > closeMins) {
            return res.status(400).json({ success: false, message: 'เวลาให้บริการคือ 08:30 ถึง 18:30' });
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
            status: { $in: ['pending', 'approved'] },
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
        
        // Save to database
        const newBooking = new Booking({
            full_name: fullName,
            faculty: faculty,
            email: email.toLowerCase(),
            phone: phoneClean,
            booking_date: bookingDate,
            start_time: startTime,
            end_time: endTime,
            purpose: purpose
        });

        await newBooking.save();
        
        const bookingResponse = newBooking.toObject();
        bookingResponse.id = bookingResponse._id; // Mapping for frontend

        // Send email notifications (fire-and-forget, don't block response)
        sendBookerConfirmationEmail(newBooking);
        sendAdminNewBookingEmail(newBooking);

        // Return 201 with booking info
        res.status(201).json({
            success: true,
            message: 'ส่งคำขอจองสำเร็จ รอการอนุมัติจาก Admin',
            booking: bookingResponse
        });
        
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
            .lean();
            
        // Map _id to id for frontend compatibility
        const formattedBookings = bookings.map(b => ({ ...b, id: b._id }));
        
        const pendingCount = await Booking.countDocuments({ status: 'pending' });
        
        res.json({ success: true, bookings: formattedBookings, pendingCount });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/admin/report
 * Returns all bookings grouped by month for the report page.
 */
app.get('/api/admin/report', requireAdmin, async (req, res, next) => {
    try {
        const bookings = await Booking.find()
            .sort({ booking_date: -1, start_time: -1 })
            .lean();

        // Group by month (YYYY-MM from booking_date)
        const grouped = {};
        bookings.forEach(b => {
            const month = b.booking_date ? b.booking_date.substring(0, 7) : 'unknown';
            if (!grouped[month]) grouped[month] = [];
            grouped[month].push({ ...b, id: b._id });
        });

        // Convert to sorted array
        const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        const report = months.map(month => ({
            month,
            bookings: grouped[month],
            total: grouped[month].length,
            approved: grouped[month].filter(b => b.status === 'approved').length,
            pending: grouped[month].filter(b => b.status === 'pending').length,
            rejected: grouped[month].filter(b => b.status === 'rejected').length,
            cancelled: grouped[month].filter(b => b.status === 'cancelled').length
        }));

        res.json({ success: true, report });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/bookings/:id/approve
 * Approve a pending booking
 */
app.post('/api/admin/bookings/:id/approve', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const booking = await Booking.findOne({ _id: id, status: 'pending' });
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือสถานะไม่ใช่รอดำเนินการ' });
        }
        
        booking.status = 'approved';
        booking.approved_at = new Date();
        await booking.save();
        
        // Send email notification
        sendEmailNotification(booking, 'approved');
        
        res.json({ success: true, message: 'อนุมัติการจองสำเร็จ' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/bookings/:id/reject
 * Reject a pending booking
 */
app.post('/api/admin/bookings/:id/reject', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const booking = await Booking.findOne({ _id: id, status: 'pending' });
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือสถานะไม่ใช่รอดำเนินการ' });
        }
        
        booking.status = 'rejected';
        booking.rejected_at = new Date();
        booking.admin_note = reason;
        await booking.save();
        
        // Send email notification
        sendEmailNotification(booking, 'rejected');
        
        res.json({ success: true, message: 'ปฏิเสธการจองแล้ว' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/admin/bookings/:id/force-cancel
 * Admin force cancel
 */
app.post('/api/admin/bookings/:id/force-cancel', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const booking = await Booking.findOne({ _id: id, status: 'approved' });
        
        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้ หรือถูกยกเลิกไปแล้ว' });
        }
        
        booking.status = 'cancelled';
        booking.cancelled_at = new Date();
        await booking.save();
        
        // Send email notification
        sendEmailNotification(booking, 'cancelled');
        
        res.json({ success: true, message: 'ยกเลิกการจองสำเร็จ' });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/admin/bookings/clear-completed
 * Remove all cancelled, rejected, and past-completed bookings from DB
 */
app.delete('/api/admin/bookings/clear-completed', requireAdmin, async (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        const result = await Booking.deleteMany({
            $or: [
                { status: { $in: ['cancelled', 'rejected'] } },
                { status: 'approved', booking_date: { $lt: today } }
            ]
        });

        res.json({
            success: true,
            message: `เคลียร์ข้อมูลสำเร็จ ลบทั้งหมด ${result.deletedCount} รายการ`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/admin/bookings/:id
 * Delete a single booking record by ID
 */
app.delete('/api/admin/bookings/:id', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findByIdAndDelete(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'ไม่พบรายการจองนี้' });
        }

        res.json({ success: true, message: `ลบรายการจองของ ${booking.full_name} สำเร็จ` });
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
