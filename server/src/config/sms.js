const API_VERSION = 'v22.0';

export const whatsappToken = process.env.WHATSAPP_TOKEN;
export const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
export const whatsappApiUrl = `https://graph.facebook.com/${API_VERSION}/${whatsappPhoneNumberId}/messages`;
