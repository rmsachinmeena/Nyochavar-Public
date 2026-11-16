// Public portfolio copy: the WhatsApp (Baileys) connection and session-sync engine is not included.
// This stub keeps the same interface so the rest of the app (OTP delivery, admin alerts, notifications) runs
// without a bot: every send reports "not connected" and callers fall back to email or the wa.me click-to-send link.

export const formatPhoneToJid = (phone) => {
  const digits = String(phone || "").replace(/D/g, "").slice(-10);
  return digits ? `91${digits}@s.whatsapp.net` : "";
};

const notAvailable = { success: true, simulated: true, error: "WhatsApp bot is not available in this build." };

export const whatsappBotService = {
  getStatus: () => ({ status: "disconnected", qrCode: null, phone: null, error: null }),
  autoResume: async () => {},
  initialize: async () => ({ status: "disconnected", qrCode: null, phone: null, error: notAvailable.error }),
  sendOtpMessage: async () => notAvailable,
  sendMessage: async () => notAvailable,
  sendImage: async () => notAvailable,
  requestPairingCode: async () => { throw new Error(notAvailable.error); },
  disconnect: async () => ({ success: true }),
  stopForShutdown: () => {},
};
