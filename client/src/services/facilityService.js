// client/src/services/facilityService.js
import api from "./api";

// =================== Resident-side helpers ===================

// Get list of facilities
export const fetchFacilities = async () => {
  const res = await api.get("/facilities");
  return res.data;
};

// Create new facility booking (Resident)
export const createFacilityBooking = async (payload) => {
  // payload: { facility_id, booking_date, start_time, end_time }
  const res = await api.post("/facility-bookings", payload);
  return res.data;
};

// Get bookings for a resident
export const fetchResidentBookings = async (residentId) => {
  const res = await api.get(`/facility-bookings/resident/${residentId}`);
  return res.data; // array of bookings
};

// =================== Admin-side helpers ===================

// Get ALL facility bookings (Admin)
export const fetchAllFacilityBookings = async () => {
  const res = await api.get("/facility-bookings/all");
  return res.data; // array of bookings with facility_name, facility_location
};

// Update booking status (Admin)
export const updateFacilityBookingStatus = async (bookingId, status) => {
  // status: "Pending" | "Approved" | "Rejected" | "Cancelled"
  const res = await api.put(`/facility-bookings/${bookingId}/status`, {
    status,
  });
  return res.data;
};
