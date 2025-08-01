import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "https://backend-google-three.vercel.app",
  // baseURL: "http://localhost:4000",

});



axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosInstance;