const localIP = process.env.REACT_APP_LOCAL_IP;

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${localIP}:5000`;

export default API_BASE_URL;
