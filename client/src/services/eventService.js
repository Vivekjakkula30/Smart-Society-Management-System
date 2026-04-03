// client/src/services/eventService.js
import api from "./api";

/**
 * Fetch events
 * scope = "upcoming" | "all"
 * - upcoming: only future/today events
 * - all: every event
 */
export const fetchEvents = async (scope = "upcoming") => {
  console.log("🔵 [eventService] GET /events?scope=", scope);

  const res = await api.get("/events", {
    params: { scope },
  });

  console.log("🟢 [eventService] GET response:", res.data);
  return res.data;
};

// Create a new event (Admin)
export const createEvent = async (payload) => {
  console.log("🔵 [eventService] POST /events", payload);
  const res = await api.post("/events", payload);
  console.log("🟢 [eventService] POST response:", res.data);
  return res.data;
};

// Update an event (Admin)
export const updateEvent = async (id, payload) => {
  console.log("🔵 [eventService] PUT /events/" + id, payload);
  const res = await api.put(`/events/${id}`, payload);
  console.log("🟢 [eventService] PUT response:", res.data);
  return res.data;
};

// Delete an event (Admin)
export const deleteEvent = async (id) => {
  console.log("🔵 [eventService] DELETE /events/" + id);
  const res = await api.delete(`/events/${id}`);
  console.log("🟢 [eventService] DELETE response:", res.data);
  return res.data;
};
