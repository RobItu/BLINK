// config/api.ts
const API_BASE = __DEV__ 
  ? 'http://localhost:3000'  // Your local backend
  : 'https://your-production-backend.com';

export { API_BASE };