async function initScheduleModule() {
  let enabled = true;
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const cfg = await response.json();
      enabled = cfg.SCHEDULE_ENABLED !== false;
    }
  } catch (err) {
    console.error('Не удалось загрузить config.json', err);
  }

  if (!enabled) {
    window.loadSchedule = showMaintenanceMessage;
    showMaintenanceMessage();
    return;
  }

  await import('./scheduleConstants.js');
  await import('./scheduleUtils.js');
  await import('./scheduleList.js');
  await import('./scheduleCalendar.js');
  await import('./scheduleManagement.js');
  await import('./scheduleModal.js');

  window.schedule = {
    utils: window.scheduleUtils,
    loadSchedule: window.loadSchedule,
    fetchAndDisplayUpcoming: window.fetchAndDisplayUpcoming,
    formatDeliveryDate: window.formatDeliveryDate,
    filterByCity: window.filterByCity,
    switchTab: window.switchTab,
    toggleExcelMenu: window.toggleExcelMenu,
    openImportModal: window.openImportModal,
    showShipmentReport: window.showShipmentReport,
    reloadShipmentReport: window.reloadShipmentReport,
    renderStaticCalendar: window.renderStaticCalendar,
    fetchDataAndUpdateCalendar: window.fetchDataAndUpdateCalendar,
    updateCalendarWithData: window.updateCalendarWithData,
    changeMonth: window.changeMonth,
    onWarehouseChange: window.onWarehouseChange,
    openShipmentsForDate: window.openShipmentsForDate,
    openScheduleManagementModal: window.openScheduleManagementModal,
    closeScheduleManagementModal: window.closeScheduleManagementModal,
    loadManagementSchedules: window.loadManagementSchedules,
    reloadManagementSchedules: window.reloadManagementSchedules,
    updateStatus: window.updateStatus,
    completeSchedule: window.completeSchedule,
    exportSchedule: window.exportSchedule,
    loadWarehousesForFilter: window.loadWarehousesForFilter,
    addNewWarehouse: window.addNewWarehouse,
    fetchScheduleData: window.fetchScheduleData,
    massManageSchedules: window.massManageSchedules,
    showMassManageMessage: window.showMassManageMessage,
    closeScheduleModal: window.closeScheduleModal,
    openSingleShipmentModal: window.openSingleShipmentModal,
    canCreateOrderForSchedule: window.canCreateOrderForSchedule,
    renderShipmentDetailsHTML: window.renderShipmentDetailsHTML,
    editSchedule: window.editSchedule,
    deleteSchedule: window.deleteSchedule,
    archiveSchedule: window.archiveSchedule,
    createOrder: window.createOrder,
    showCreateForm: window.showCreateForm,
    addNewCity: window.addNewCity,
    deleteSelectedCity: window.deleteSelectedCity,
    addNewWarehouseAndRefresh: window.addNewWarehouseAndRefresh,
    enterWarehouseEditMode: window.enterWarehouseEditMode,
    cancelWarehouseEdits: window.cancelWarehouseEdits,
    saveWarehouseEdits: window.saveWarehouseEdits,
    confirmWarehouseDelete: window.confirmWarehouseDelete,
    SCHEDULE_STATUSES: window.SCHEDULE_STATUSES,
    MARKETPLACES: window.MARKETPLACES,
    TIME_SLOTS: window.TIME_SLOTS,
    calendar: {
      renderStaticCalendar: window.renderStaticCalendar,
      fetchDataAndUpdateCalendar: window.fetchDataAndUpdateCalendar,
      changeMonth: window.changeMonth,
      openShipmentsForDate: window.openShipmentsForDate,
    },
    management: {
      openScheduleManagementModal: window.openScheduleManagementModal,
      massManageSchedules: window.massManageSchedules,
      updateStatus: window.updateStatus,
    },
    modal: {
      openSingleShipmentModal: window.openSingleShipmentModal,
      renderShipmentDetailsHTML: window.renderShipmentDetailsHTML,
      closeScheduleModal: window.closeScheduleModal,
    }
  };
}

function showMaintenanceMessage() {
  const container = document.getElementById('dynamicContent');
  const msg = 'Раздел "Расписание" временно недоступен из-за технических работ.';
  if (container) {
    container.innerHTML = `<div class="maintenance-message">${msg}</div>`;
  } else {
    alert(msg);
  }
}

initScheduleModule();
window.showMaintenanceMessage = showMaintenanceMessage;
