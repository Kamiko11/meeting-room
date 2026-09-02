// Booking module - form submission and cancellation
const BookingModule = {
  init() {
    const form = document.getElementById('booking-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitBooking();
      });
    }

    const startTimeInput = document.getElementById('start-time');
    if (startTimeInput) {
      startTimeInput.addEventListener('change', (e) => {
        const endTimeSelect = document.getElementById('end-time');
        const startTime = e.target.value;
        // Disable end-time options that are <= start time
        Array.from(endTimeSelect.options).forEach(option => {
          if (option.value === '') return; // skip placeholder
          option.disabled = option.value <= startTime;
        });
        // Reset end-time if current selection is invalid
        if (endTimeSelect.value && endTimeSelect.value <= startTime) {
          endTimeSelect.value = '';
        }
      });
    }
  },

  async submitBooking() {
    const form = document.getElementById('booking-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    const data = {
      fullName: document.getElementById('full-name').value.trim(),
      faculty: document.getElementById('faculty').value,
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      bookingDate: document.getElementById('booking-date').value,
      startTime: document.getElementById('start-time').value,
      endTime: document.getElementById('end-time').value,
      purpose: document.getElementById('purpose').value.trim()
    };

    if (!data.fullName || !data.faculty || !data.email || !data.phone || !data.bookingDate || !data.startTime || !data.endTime || !data.purpose) {
      App.showToast('กรุณากรอกข้อมูลให้ครบทุกช่อง', 'warning');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      App.showToast('กรุณากรอกอีเมลให้ถูกต้อง', 'warning');
      return;
    }

    // Validate phone
    const phoneClean = data.phone.replace(/[-\s]/g, '');
    if (!/^0\d{8,9}$/.test(phoneClean)) {
      App.showToast('กรุณากรอกเบอร์โทรให้ถูกต้อง (เช่น 0812345678)', 'warning');
      return;
    }

    if (data.startTime >= data.endTime) {
      App.showToast('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> กำลังจอง...';

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        this.showSuccessModal(result.booking);
        form.reset();
        if (window.CalendarModule) {
          CalendarModule.refreshEvents();
        }
        App.showToast('ส่งคำขอจองสำเร็จ รอการอนุมัติ', 'success');
      } else {
        if (result.conflicts) {
          let conflictMsg = result.message + '\n\nรายการที่ชนกัน:';
          result.conflicts.forEach(c => {
            conflictMsg += `\n• ${c.full_name} (${c.start_time} - ${c.end_time})`;
          });
          App.showToast(conflictMsg, 'error', 6000);
        } else {
          App.showToast(result.message, 'error');
        }
      }
    } catch (error) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
      console.error('Booking error:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.innerHTML = originalText;
    }
  },

  showSuccessModal(booking) {
    document.getElementById('success-name').textContent = booking.full_name || booking.fullName;
    document.getElementById('success-faculty').textContent = booking.faculty;
    document.getElementById('success-date').textContent = App.formatDateThai(booking.booking_date || booking.bookingDate);
    document.getElementById('success-time').textContent = 
      App.formatTime(booking.start_time || booking.startTime) + ' - ' + App.formatTime(booking.end_time || booking.endTime);
    document.getElementById('success-purpose').textContent = booking.purpose;
    document.getElementById('success-email').textContent = booking.email;
    
    App.openModal('success-modal');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  BookingModule.init();
});
