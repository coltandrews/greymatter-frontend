export type HubAppointmentRow = {
  id: string;
  status: string;
  starts_at: string;
  created_at: string;
  updated_at: string;
  provider_name: string | null;
  ola_redirect_url: string | null;
  ola_popup_message: string | null;
  ola_order_guid: string | null;
};

export type HubBookingIntentRow = {
  id: string;
  booking_status: string;
  payment_status: string;
  ola_status: string;
  selected_slot: unknown;
  intake_data: unknown;
  stripe_checkout_session_id: string | null;
  created_at: string;
  updated_at: string;
  ola_redirect_url: string | null;
  ola_popup_message: string | null;
  ola_order_guid: string | null;
  failure_reason: string | null;
};
