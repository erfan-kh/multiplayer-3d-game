const localIP = "192.168.1.106"; // your laptop's IP on the local network
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${localIP}:5000`;

export default API_BASE_URL;
