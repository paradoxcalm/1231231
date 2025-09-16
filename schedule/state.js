export const state = {
    calendarCurrentDate: new Date(),
    canCreate: false,
    canCreateSchedule: false,
    canCreateOrder: false,
    currentModal: null,
    activeCityFilter: "",
    activeWarehouseFilter: "",
    activeDestinationWarehouseFilter: "",
    activeStatusFilter: "",
    archiveView: false,
    activeMarketplaceFilter: ""
};

export function setPermissionFlags({ canCreate = false, canCreateSchedule = false, canCreateOrder = false } = {}) {
    state.canCreate = canCreate;
    state.canCreateSchedule = canCreateSchedule;
    state.canCreateOrder = canCreateOrder;
}

export function setCurrentModal(modal) {
    state.currentModal = modal;
}

export function resetFiltersState() {
    state.activeCityFilter = "";
    state.activeDestinationWarehouseFilter = "";
    state.activeMarketplaceFilter = "";
}

export function syncWindowFilters() {
    if (typeof window !== "undefined") {
        window.activeMarketplaceFilter = state.activeMarketplaceFilter;
        window.activeCityFilter = state.activeCityFilter;
        window.activeDestinationWarehouseFilter = state.activeDestinationWarehouseFilter;
    }
}
