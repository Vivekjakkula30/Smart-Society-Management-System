// client/src/services/flatService.js
import api from "./api";

export const fetchFlats = async () => {
  const res = await api.get("/flats");
  return res.data;
};
