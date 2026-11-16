/**
 * Central API Configuration
 * 
 * When deploying your backend to production (e.g. Render, Railway, AWS, VPS):
 * Simply update `VITE_API_URL` in your Frontend `.env` file with your backend URL.
 * 
 * This helper automatically handles:
 * - Trailing slashes (e.g., "https://api.site.com/" -> "https://api.site.com/api")
 * - Missing "/api" path (e.g., "https://api.site.com" -> "https://api.site.com/api")
 * - Already included "/api" (e.g., "https://api.site.com/api" -> "https://api.site.com/api")
 * - Localhost fallback for local development: "http://localhost:5000/api"
 */
const rawUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');

export const API_BASE_URL: string = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;
