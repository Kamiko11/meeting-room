// Cancel Module - Self-service booking cancellation with OTP verification
const CancelModule = {
  currentEmail: null,
  currentBookingId: null,
  countdownInterval: null,

  // ============================================================
  //  SEARCH BOOKINGS BY EMAIL
  // ============================================================
  async searchBookings() {
    const emailInput = document.getElementById('cancel-email');
    const email = emailInput.value.trim();
    const resultsDiv = document.getElementById('cancel-results');

    if (!email) {
      App.showToast('กรุณากรอกอีเมล', 'warning');
      emailInput.focus();
      return;
    }

    // Validate email
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@g\.swu\.ac\.th$/;
    const isTestEmail = email.toLowerCase() === 'aom3222ad@gmail.com';
    if (!emailRegex.test(email) && !isTestEmail) {
      App.showToast('กรุณาใช้อีเมลมหาวิทยาลัย (@g.swu.ac.th)', 'warning');
      return;
    }

    resultsDiv.innerHTML = '<div class="cancel-loading">⏳ กำลังค้นหา...</div>';

    try {
      const res = await fetch('/api/my-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!data.success) {
        resultsDiv.innerHTML = `<div class="cancel-empty">❌ ${data.message}</div>`;
        return;
      }

      this.currentEmail = email;

      if (data.bookings.length === 0) {
        resultsDiv.innerHTML = '<div class="cancel-empty">ไม่พบรายการจองที่ยังใช้งานอยู่สำหรับอีเมลนี้</div>';
        return;
      }

      this.renderResults(data.bookings);
    } catch (err) {
      resultsDiv.innerHTML = '<div class="cancel-empty">❌ เกิดข้อผิดพลาด กรุณาลองใหม่</div>';
    }
  },

  renderResults(bookings) {
    const resultsDiv = document.getElementById('cancel-results');

    const statusText = (status) => {
      if (status === 'pending') return '<span class="cancel-status cancel-status-pending">⏳ รออนุมัติ</span>';
      if (status === 'approved') return '<span class="cancel-status cancel-status-approved">✅ อนุมัติแล้ว</span>';
      return status;
    };

    let html = `<div class="cancel-results-header">📋 พบ ${bookings.length} รายการจอง</div>`;
    html += '<div class="cancel-results-list">';

    bookings.forEach(b => {
      const dateThai = App.formatDateThai(b.booking_date);
      const timeRange = App.formatTime(b.start_time) + ' - ' + App.formatTime(b.end_time);

      html += `
        <div class="cancel-booking-card">
          <div class="cancel-booking-info">
            <div class="cancel-booking-date">📅 ${dateThai}</div>
            <div class="cancel-booking-time">⏰ ${timeRange}</div>
            <div class="cancel-booking-purpose">📌 ${this.escapeHtml(b.purpose)}</div>
            <div class="cancel-booking-meta">${statusText(b.status)} · ${this.escapeHtml(b.faculty)}</div>
          </div>
          <div class="cancel-booking-action">
            <button class="btn btn-danger btn-cancel-booking" onclick="CancelModule.requestOTP('${b.id}', '${dateThai}', '${timeRange}')">
              🗑️ ยกเลิกการจอง
            </button>
          </div>
        </div>`;
    });

    html += '</div>';
    resultsDiv.innerHTML = html;
  },

  // ============================================================
  //  REQUEST OTP
  // ============================================================
  async requestOTP(bookingId, dateText, timeText) {
    if (!this.currentEmail) {
      App.showToast('กรุณาค้นหาด้วยอีเมลก่อน', 'warning');
      return;
    }

    this.currentBookingId = bookingId;

    // Show target info in modal
    document.getElementById('otp-target-info').innerHTML = `
      <p>📅 <strong>${dateText}</strong> | ⏰ <strong>${timeText}</strong></p>
      <p>📧 รหัส OTP จะส่งไปที่: <strong>${this.currentEmail}</strong></p>
    `;
    document.getElementById('otp-input').value = '';

    App.showToast('⏳ กำลังส่งรหัส OTP...', 'info');

    try {
      const res = await fetch('/api/request-cancel-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.currentEmail, bookingId })
      });
      const data = await res.json();

      if (!data.success) {
        App.showToast(data.message, 'error');
        return;
      }

      App.showToast('📧 ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว', 'success');
      App.openModal('otp-modal');
      this.startCountdown();
      document.getElementById('otp-input').focus();
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    }
  },

  // ============================================================
  //  CONFIRM OTP & CANCEL
  // ============================================================
  async confirmOTP() {
    const otp = document.getElementById('otp-input').value.trim();

    if (!otp || otp.length !== 6) {
      App.showToast('กรุณากรอกรหัส OTP 6 หลัก', 'warning');
      return;
    }

    const btn = document.getElementById('btn-confirm-otp');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังยืนยัน...';

    try {
      const res = await fetch('/api/cancel-with-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.currentEmail,
          bookingId: this.currentBookingId,
          otp: otp
        })
      });
      const data = await res.json();

      App.closeModal('otp-modal');
      this.stopCountdown();

      if (data.success) {
        App.showToast('✅ ยกเลิกการจองเรียบร้อยแล้ว', 'success');
        // Refresh the search results
        this.searchBookings();
        // Refresh calendar
        if (window.CalendarModule) {
          CalendarModule.refreshEvents();
        }
      } else {
        App.showToast(data.message, 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔐 ยืนยันยกเลิกการจอง';
    }
  },

  // ============================================================
  //  COUNTDOWN TIMER
  // ============================================================
  startCountdown() {
    this.stopCountdown();
    let remaining = 5 * 60; // 5 minutes in seconds
    const countdownEl = document.getElementById('otp-countdown');

    const update = () => {
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      countdownEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;

      if (remaining <= 0) {
        this.stopCountdown();
        countdownEl.textContent = 'หมดอายุ';
        App.showToast('รหัส OTP หมดอายุ กรุณาขอรหัสใหม่', 'warning');
      }
      remaining--;
    };

    update();
    this.countdownInterval = setInterval(update, 1000);
  },

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  },

  // ============================================================
  //  UTILS
  // ============================================================
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
