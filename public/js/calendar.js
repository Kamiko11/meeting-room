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
      slotMaxTime: '16:30:00',
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
      
      // Custom event rendering
      eventDidMount: (info) => {
        info.el.style.cursor = 'pointer';
        info.el.title = info.event.title;
      },
      
      eventColor: '#1565c0',
      eventTextColor: '#ffffff',
      
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
    
    // Store event id globally in BookingModule to use it for cancellation
    if (typeof BookingModule !== 'undefined') {
      BookingModule.currentBookingId = event.id;
    }
    
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
