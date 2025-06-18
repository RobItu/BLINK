// config/api.ts
const API_BASE = __DEV__ 
  ? 'https://27d9-24-170-98-155.ngrok-free.app'  // Your local backend
  : 'https://localhost:3000'; 
export { API_BASE };