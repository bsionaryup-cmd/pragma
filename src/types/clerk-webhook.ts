/** Payload simplificado de eventos user.* de Clerk */
export type ClerkWebhookUserData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email_addresses: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id: string | null;
};

export type ClerkWebhookEvent = {
  type: string;
  data: ClerkWebhookUserData;
};
