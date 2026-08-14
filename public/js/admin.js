// Admin Dashboard Module
const Admin = {
  password: null,
  bookings: [],
  targetBookingId: null,
  targetBookingName: null,

  // ============================================================
  //  INITIALIZATION
  // ============================================================
  init() {
    // Check if already logged in (sessionStorage)
    const saved = sessionStorage.getItem('adminPassword');
    if (saved) {
      this.password = saved;
      this.showDashboard();
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.login();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      this.logout();
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.loadBookings();
    });

    // Filters
    document.getElementById('filter-status').addEventListener('change', () => {
      this.renderTable();
    });
    document.getElementById('filter-search').addEventListener('input', () => {
      this.renderTable();
    });

    // Modal close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) App.closeModal(modal.id);
      });
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) App.closeModal(modal.id);
      });
    });

    // Force cancel confirm button
    document.getElementById('btn-confirm-force-cancel').addEventListener('click', () => {
      this.executeForceCancel();
    });

    // Cancel back button
    document.getElementById('btn-cancel-back').addEventListener('click', () => {
      App.closeModal('admin-cancel-modal');
    });
  },

  // ============================================================
  //  AUTH
  // ============================================================
  async login() {
    const passwordInput = document.getElementById('admin-password');
    const password = passwordInput.value.trim();
    const errorEl = document.getElementById('login-error');
    const loginBtn = document.getElementById('btn-login');

    if (!password) {
      errorEl.textContent = 'กรุณากรอกรหัสผ่าน';
      errorEl.style.display = 'block';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> กำลังตรวจสอบ...';
    errorEl.style.display = 'none';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success) {
        this.password = password;
        sessionStorage.setItem('adminPassword', password);
        this.showDashboard();
        App.showToast('เข้าสู่ระบบ Admin สำเร็จ', 'success');
      } else {
        errorEl.textContent = data.message || 'รหัสผ่านไม่ถูกต้อง';
        errorEl.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (err) {
      errorEl.textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      errorEl.style.display = 'block';
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'เข้าสู่ระบบ';
    }
  },

  logout() {
    this.password = null;
    sessionStorage.removeItem('adminPassword');
    document.getElementById('dashboard-screen').style.display = 'none';
    document.getElementById('header-actions').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    document.getElementById('admin-password').value = '';
    App.showToast('ออกจากระบบแล้ว', 'info');
  },

  showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = '';
    document.getElementById('header-actions').style.display = 'flex';
    this.loadBookings();
  },

  // ============================================================
  //  DATA
  // ============================================================
  async loadBookings() {
    try {
      const res = await fetch('/api/admin/bookings', {
        headers: { 'Authorization': `Bearer ${this.password}` }
      });

      if (res.status === 401 || res.status === 403) {
        App.showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
        this.logout();
        return;
      }

      const data = await res.json();
      if (data.success) {
        this.bookings = data.bookings;
        this.updateStats();
        this.renderTable();
      }
    } catch (err) {
      App.showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
    }
  },

  updateStats() {
    const total = this.bookings.length;
    const active = this.bookings.filter(b => b.status === 'active').length;
    const cancelled = this.bookings.filter(b => b.status === 'cancelled').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-cancelled').textContent = cancelled;
  },

  // ============================================================
  //  TABLE RENDERING
  // ============================================================
  getFilteredBookings() {
    const statusFilter = document.getElementById('filter-status').value;
    const searchQuery = document.getElementById('filter-search').value.trim().toLowerCase();

    return this.bookings.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (searchQuery) {
        const haystack = `${b.full_name} ${b.faculty} ${b.purpose}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });
  },

  renderTable() {
    const tbody = document.getElementById('bookings-tbody');
    const filtered = this.getFilteredBookings();

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">ไม่พบรายการจอง</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((b, index) => {
      const isActive = b.status === 'active';
      const statusClass = isActive ? 'status-active' : 'status-cancelled';
      const statusText = isActive ? '✅ ใช้งาน' : '❌ ยกเลิก';
      const dateThai = App.formatDateThai(b.booking_date);
      const timeRange = App.formatTime(b.start_time) + ' - ' + App.formatTime(b.end_time);

      const actionBtns = isActive
        ? `<div class="action-btns">
             <button class="btn-action btn-force-cancel" onclick="Admin.confirmForceCancel(${b.id}, '${this.escapeHtml(b.full_name)}', '${dateThai} ${timeRange}')">
               ยกเลิก
             </button>
             <button class="btn-action btn-reset-pin" onclick="Admin.resetPin(${b.id}, '${this.escapeHtml(b.full_name)}')">
               รีเซ็ต PIN
             </button>
           </div>`
        : `<span style="color:var(--color-text-secondary); font-size:0.8rem;">—</span>`;

      return `<tr style="animation-delay:${index * 0.03}s">
        <td><strong>#${b.id}</strong></td>
        <td>${this.escapeHtml(b.full_name)}</td>
        <td>${this.escapeHtml(b.faculty)}</td>
        <td>${dateThai}</td>
        <td>${timeRange}</td>
        <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${this.escapeHtml(b.purpose)}">${this.escapeHtml(b.purpose)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${actionBtns}</td>
      </tr>`;
    }).join('');
  },

  // ============================================================
  //  ACTIONS
  // ============================================================
  confirmForceCancel(id, name, detail) {
    this.targetBookingId = id;
    this.targetBookingName = name;
    document.getElementById('cancel-target-name').textContent = name;
    document.getElementById('cancel-target-detail').textContent = detail;
    App.openModal('admin-cancel-modal');
  },

  async executeForceCancel() {
    const btn = document.getElementById('btn-confirm-force-cancel');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังยกเลิก...';

    try {
      const res = await fetch(`/api/admin/bookings/${this.targetBookingId}/force-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`
        }
      });
      const data = await res.json();

      App.closeModal('admin-cancel-modal');

      if (data.success) {
        App.showToast(`ยกเลิกการจองของ ${this.targetBookingName} สำเร็จ`, 'success');
        this.loadBookings();
      } else {
        App.showToast(data.message, 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'ยืนยันยกเลิกการจอง';
    }
  },

  async resetPin(id, name) {
    const btn = event.target;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'กำลังรีเซ็ต...';

    try {
      const res = await fetch(`/api/admin/bookings/${id}/reset-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`
        }
      });
      const data = await res.json();

      if (data.success) {
        document.getElementById('pin-target-name').textContent = name;
        document.getElementById('admin-new-pin').textContent = data.newPin;
        App.openModal('admin-pin-modal');
        App.showToast('รีเซ็ต PIN สำเร็จ', 'success');
      } else {
        App.showToast(data.message, 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});
