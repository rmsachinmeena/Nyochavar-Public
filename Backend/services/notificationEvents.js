import { EventEmitter } from 'node:events';

/** In-process bus: the notification service emits, the buyer socket pushes it to the user's open tabs live. */
export const notificationEvents = new EventEmitter();
