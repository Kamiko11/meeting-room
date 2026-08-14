const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const bookingSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    faculty: { type: String, required: true },
    booking_date: { type: String, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    purpose: { type: String, required: true },
    cancel_pin: { type: String, required: true },
    status: { type: String, default: 'active', enum: ['active', 'cancelled'] },
    cancelled_at: { type: Date }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = { connectDB, Booking };
