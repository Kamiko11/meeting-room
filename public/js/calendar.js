// Calendar module - FullCalendar integration
const CalendarModule = {
  calendar: null,

  init() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    this.calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      locale: 'th',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek'
      },
      buttonText: {
        today: 'วันนี้',
        month: 'เดือน',
        week: 'สัปดาห์'
      },
      slotMinTime: '08:30:00',
      slotMaxTime: '18:30:00',
      allDaySlot: false,
      selectable: false,
      editable: false,
      
      // Events source - fetch from API
      events: {
        url: '/api/bookings',
        method: 'GET',
        failure: () => App.showToast('ไม่สามารถโหลดข้อมูลปฏิทินได้', 'error')
      },
      
      // Event click handler - show detail modal
      eventClick: (info) => {
        this.showBookingDetail(info.event);
      },
      
      // Custom event content - show full time range
      eventContent: (arg) => {
        const start = arg.event.start;
        const end = arg.event.end;
        const formatTime = (d) => d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        const timeText = formatTime(start) + ' - ' + formatTime(end);
        
        const container = document.createElement('div');
        container.style.cssText = 'padding:2px 4px;width:100%;line-height:1.3;';
        container.innerHTML = `<div style="font-weight:700;font-size:0.8rem;">⏰ ${timeText}</div><div style="font-size:0.75rem;opacity:0.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${arg.event.title}</div>`;
        return { domNodes: [container] };
      },

      // Custom event rendering
      eventDidMount: (info) => {
        info.el.style.cursor = 'pointer';
        const start = info.event.start;
        const end = info.event.end;
        const formatTime = (d) => d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        info.el.title = formatTime(start) + ' - ' + formatTime(end) + ' ' + info.event.title;
      },
      
      height: 'auto',
      contentHeight: 'auto'
    });
    
    this.calendar.render();
  },

  showBookingDetail(event) {
    const props = event.extendedProps;
    
    document.getElementById('detail-name').textContent = props.fullName || '-';
    document.getElementById('detail-faculty').textContent = props.faculty || '-';
    document.getElementById('detail-date').textContent = App.formatDateThai(props.bookingDate || event.startStr.split('T')[0]);
    document.getElementById('detail-time').textContent = 
      App.formatTime(props.startTime) + ' - ' + App.formatTime(props.endTime);
    document.getElementById('detail-purpose').textContent = props.purpose || '-';
    
    const statusHtml = props.status === 'approved' 
      ? '<span class="status-approved">✅ อนุมัติแล้ว</span>' 
      : '<span class="status-pending">⏳ รออนุมัติ</span>';
    document.getElementById('detail-status').innerHTML = statusHtml;
    
    App.openModal('detail-modal');
  },

  refreshEvents() {
    if (this.calendar) {
      this.calendar.refetchEvents();
    }
  }
};

// Initialize calendar when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  CalendarModule.init();
});
