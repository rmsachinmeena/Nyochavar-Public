import type { AuthPrincipal } from '../services/tokenService.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middlewares after a valid access token is verified. */
      auth?: AuthPrincipal;
    }
  }
}

export {};
