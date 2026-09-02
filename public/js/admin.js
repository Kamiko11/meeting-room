// Admin Dashboard Module
const Admin = {
  password: null,
  bookings: [],
  targetBookingId: null,
  targetBookingName: null,
  lastPendingCount: -1,
  pollingInterval: null,

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

    // Approve confirm button
    document.getElementById('btn-confirm-approve').addEventListener('click', () => {
      this.executeApprove();
    });
    document.getElementById('btn-approve-back').addEventListener('click', () => {
      App.closeModal('admin-approve-modal');
    });

    // Reject confirm button
    document.getElementById('btn-confirm-reject').addEventListener('click', () => {
      this.executeReject();
    });
    document.getElementById('btn-reject-back').addEventListener('click', () => {
      App.closeModal('admin-reject-modal');
    });

    // Force cancel confirm button
    document.getElementById('btn-confirm-force-cancel').addEventListener('click', () => {
      this.executeForceCancel();
    });
    document.getElementById('btn-cancel-back').addEventListener('click', () => {
      App.closeModal('admin-cancel-modal');
    });

    // Clear data button and modal
    document.getElementById('btn-clear-data').addEventListener('click', () => {
      this.confirmClearData();
    });
    document.getElementById('btn-confirm-clear').addEventListener('click', () => {
      this.executeClearData();
    });
    document.getElementById('btn-clear-back').addEventListener('click', () => {
      App.closeModal('admin-clear-modal');
    });

    // Delete single record modal
    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
      this.executeDelete();
    });
    document.getElementById('btn-delete-back').addEventListener('click', () => {
      App.closeModal('admin-delete-modal');
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
    this.stopPolling();
    document.getElementById('dashboard-screen').style.display = 'none';
    document.getElementById('header-actions').style.display = 'none';
    document.getElementById('login-screen').style.display = '';
    document.getElementById('admin-password').value = '';
    document.title = 'Admin Dashboard | ระบบจองห้องประชุม มศว';
    App.showToast('ออกจากระบบแล้ว', 'info');
  },

  showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = '';
    document.getElementById('header-actions').style.display = 'flex';
    this.loadBookings();
    this.startPolling();
  },

  // ============================================================
  //  POLLING (check for new pending bookings every 30s)
  // ============================================================
  startPolling() {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      this.loadBookings();
    }, 30000);
  },

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
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
        const pendingCount = data.pendingCount || 0;

        // Notify if new pending bookings arrived (skip initial load when lastPendingCount is -1)
        if (pendingCount > this.lastPendingCount && this.lastPendingCount >= 0) {
          const newCount = pendingCount - this.lastPendingCount;
          App.showToast(`📬 มีคำขอจองใหม่ ${newCount} รายการ!`, 'warning', 5000);
          this.playNotificationSound();
        }
        this.lastPendingCount = pendingCount;

        // Update title with pending count
        if (pendingCount > 0) {
          document.title = `(${pendingCount}) Admin Dashboard | ระบบจองห้องประชุม มศว`;
        } else {
          document.title = 'Admin Dashboard | ระบบจองห้องประชุม มศว';
        }

        this.updateStats();
        this.renderTable();
      }
    } catch (err) {
      App.showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
    }
  },

  playNotificationSound() {
    try {
      // Use Web Audio API for a simple beep
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gain.gain.value = 0.3;
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
      }, 200);
    } catch (e) {
      // Ignore audio errors
    }
  },

  updateStats() {
    const total = this.bookings.length;
    const pending = this.bookings.filter(b => b.status === 'pending').length;
    const approved = this.bookings.filter(b => b.status === 'approved').length;
    const cancelledRejected = this.bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    document.getElementById('stat-cancelled').textContent = cancelledRejected;
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
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">ไม่พบรายการจอง</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((b, index) => {
      const dateThai = App.formatDateThai(b.booking_date);
      const timeRange = App.formatTime(b.start_time) + ' - ' + App.formatTime(b.end_time);

      let statusClass, statusText;
      switch (b.status) {
        case 'pending':
          statusClass = 'status-pending-badge';
          statusText = '⏳ รออนุมัติ';
          break;
        case 'approved':
          statusClass = 'status-active';
          statusText = '✅ อนุมัติ';
          break;
        case 'rejected':
          statusClass = 'status-rejected';
          statusText = '❌ ปฏิเสธ';
          break;
        case 'cancelled':
          statusClass = 'status-cancelled';
          statusText = '🚫 ยกเลิก';
          break;
        default:
          statusClass = '';
          statusText = b.status;
      }

      let actionBtns = `<div class="action-btns">
        <button class="btn-action btn-info" onclick="Admin.viewDetails('${b.id}')">
          🔍 ดูข้อมูล
        </button>`;

      if (b.status === 'pending') {
        actionBtns += `
          <button class="btn-action btn-approve" onclick="Admin.confirmApprove('${b.id}', '${this.escapeHtml(b.full_name)}', '${dateThai} ${timeRange}')">
            ✅ อนุมัติ
          </button>
          <button class="btn-action btn-reject" onclick="Admin.confirmReject('${b.id}', '${this.escapeHtml(b.full_name)}', '${dateThai} ${timeRange}')">
            ❌ ปฏิเสธ
          </button>`;
      } else if (b.status === 'approved') {
        actionBtns += `
          <button class="btn-action btn-force-cancel" onclick="Admin.confirmForceCancel('${b.id}', '${this.escapeHtml(b.full_name)}', '${dateThai} ${timeRange}')">
            ยกเลิก
          </button>`;
      } else {
        actionBtns += `
          <button class="btn-action btn-delete" onclick="Admin.confirmDelete('${b.id}', '${this.escapeHtml(b.full_name)}', '${dateThai} ${timeRange}')">
            🗑️ ลบ
          </button>`;
      }
      
      actionBtns += `</div>`;

      return `<tr style="animation-delay:${index * 0.03}s" class="${b.status === 'pending' ? 'row-pending' : ''}">
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
  //  ACTIONS: APPROVE
  // ============================================================
  confirmApprove(id, name, detail) {
    this.targetBookingId = id;
    this.targetBookingName = name;
    document.getElementById('approve-target-name').textContent = name;
    document.getElementById('approve-target-detail').textContent = detail;
    App.openModal('admin-approve-modal');
  },

  async executeApprove() {
    const btn = document.getElementById('btn-confirm-approve');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังอนุมัติ...';

    try {
      const res = await fetch(`/api/admin/bookings/${this.targetBookingId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`
        }
      });
      const data = await res.json();

      App.closeModal('admin-approve-modal');

      if (data.success) {
        App.showToast(`อนุมัติการจองของ ${this.targetBookingName} สำเร็จ`, 'success');
        this.loadBookings();
      } else {
        App.showToast(data.message, 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '✅ อนุมัติ';
    }
  },

  // ============================================================
  //  ACTIONS: REJECT
  // ============================================================
  confirmReject(id, name, detail) {
    this.targetBookingId = id;
    this.targetBookingName = name;
    document.getElementById('reject-target-name').textContent = name;
    document.getElementById('reject-target-detail').textContent = detail;
    document.getElementById('reject-reason').value = '';
    App.openModal('admin-reject-modal');
  },

  async executeReject() {
    const btn = document.getElementById('btn-confirm-reject');
    const reason = document.getElementById('reject-reason').value.trim();
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังปฏิเสธ...';

    try {
      const res = await fetch(`/api/admin/bookings/${this.targetBookingId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();

      App.closeModal('admin-reject-modal');

      if (data.success) {
        App.showToast(`ปฏิเสธการจองของ ${this.targetBookingName} แล้ว`, 'success');
        this.loadBookings();
      } else {
        App.showToast(data.message, 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '❌ ปฏิเสธการจอง';
    }
  },

  // ============================================================
  //  ACTIONS: FORCE CANCEL (approved bookings only)
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

  // ============================================================
  //  ACTIONS: VIEW DETAILS
  // ============================================================
  viewDetails(id) {
    const b = this.bookings.find(x => x.id === id);
    if (!b) return;

    document.getElementById('view-name').textContent = b.full_name;
    document.getElementById('view-faculty').textContent = b.faculty;
    document.getElementById('view-email').textContent = b.email || '-';
    document.getElementById('view-phone').textContent = b.phone || '-';
    document.getElementById('view-date').textContent = App.formatDateThai(b.booking_date);
    document.getElementById('view-time').textContent = App.formatTime(b.start_time) + ' - ' + App.formatTime(b.end_time) + ' น.';
    document.getElementById('view-purpose').textContent = b.purpose;

    let statusText = b.status;
    if (b.status === 'pending') statusText = '⏳ รออนุมัติ';
    else if (b.status === 'approved') statusText = '✅ อนุมัติแล้ว';
    else if (b.status === 'rejected') statusText = '❌ ปฏิเสธ';
    else if (b.status === 'cancelled') statusText = '🚫 ยกเลิกแล้ว';
    document.getElementById('view-status').textContent = statusText;

    const noteContainer = document.getElementById('view-note-container');
    const noteText = document.getElementById('view-note');
    if (b.admin_note) {
      noteText.textContent = b.admin_note;
      noteContainer.style.display = '';
    } else {
      noteContainer.style.display = 'none';
    }

    App.openModal('admin-detail-modal');
  },

  // ============================================================
  //  ACTIONS: DELETE SINGLE RECORD
  // ============================================================
  confirmDelete(id, name, detail) {
    this.targetBookingId = id;
    this.targetBookingName = name;
    document.getElementById('delete-target-name').textContent = name;
    document.getElementById('delete-target-detail').textContent = detail;
    App.openModal('admin-delete-modal');
  },

  async executeDelete() {
    const btn = document.getElementById('btn-confirm-delete');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังลบ...';

    try {
      const res = await fetch(`/api/admin/bookings/${this.targetBookingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`
        }
      });
      const data = await res.json();

      App.closeModal('admin-delete-modal');

      if (data.success) {
        App.showToast(data.message, 'success');
        this.loadBookings();
      } else {
        App.showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🗑️ ยืนยันลบ';
    }
  },

  // ============================================================
  //  ACTIONS: CLEAR COMPLETED DATA
  // ============================================================
  confirmClearData() {
    App.openModal('admin-clear-modal');
  },

  async executeClearData() {
    const btn = document.getElementById('btn-confirm-clear');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> กำลังเคลียร์...';

    try {
      const res = await fetch('/api/admin/bookings/clear-completed', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`
        }
      });
      const data = await res.json();

      App.closeModal('admin-clear-modal');

      if (data.success) {
        App.showToast(data.message, 'success');
        this.loadBookings();
      } else {
        App.showToast(data.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (err) {
      App.showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🧹 ยืนยันเคลียร์ข้อมูล';
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
