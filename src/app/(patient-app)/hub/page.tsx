import { createClient } from "@/lib/supabase/server";
import type { IntakeDraftData } from "@/lib/intake/draftData";
import { mergeIntakeAndProfileDemographics } from "@/lib/intake/mergeDemographics";
import { patientWelcomeName } from "@/lib/patientDisplayName";
import {
  FALLBACK_TREATMENT_PRODUCTS,
  treatmentProductFromRow,
  type TreatmentProduct,
} from "@/lib/treatmentProducts";
import { PatientHubWorkspace } from "./PatientHubWorkspace";

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [
    { data: rows, error },
    { data: bookingRows, error: bookingError },
    { data: profile },
    { data: draftRow },
    { data: productRows },
    { data: bookingOlaRows },
    { data: appointmentOlaRows },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, status, starts_at, created_at, updated_at, provider_name, ola_redirect_url, ola_popup_message, ola_order_guid")
      .eq("user_id", user.id)
      .order("starts_at", { ascending: true }),
    supabase
      .from("booking_intents")
      .select("id, booking_status, payment_status, ola_status, selected_slot, intake_data, stripe_checkout_session_id, created_at, updated_at, ola_redirect_url, ola_popup_message, ola_order_guid")
      .eq("user_id", user.id)
      .neq("booking_status", "draft")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("demographics")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("intake_drafts")
      .select("step, data")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("treatment_products")
      .select("id, product_key, name, label, summary, description, service_key, service_type, billing_type, price_id, consultation_fee_cents, medication_fee_cents, currency, question_set_key, sort_order")
      .eq("patient_visible", true)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("booking_intents")
      .select("ola_user_guid")
      .eq("user_id", user.id)
      .not("ola_user_guid", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("appointments")
      .select("ola_user_guid")
      .eq("user_id", user.id)
      .not("ola_user_guid", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const appointments = (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    starts_at: r.starts_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    provider_name: r.provider_name,
    ola_redirect_url: r.ola_redirect_url,
    ola_popup_message: r.ola_popup_message,
    ola_order_guid: r.ola_order_guid,
  }));
  const bookingIntents = (bookingRows ?? []).map((r) => ({
    id: r.id,
    booking_status: r.booking_status,
    payment_status: r.payment_status,
    ola_status: r.ola_status,
    selected_slot: r.selected_slot,
    intake_data: r.intake_data,
    stripe_checkout_session_id: r.stripe_checkout_session_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    ola_redirect_url: r.ola_redirect_url,
    ola_popup_message: r.ola_popup_message,
    ola_order_guid: r.ola_order_guid,
  }));
  const products =
    (productRows ?? [])
      .map((row) => treatmentProductFromRow(row))
      .filter((row): row is TreatmentProduct => row != null);
  const visibleProducts = products.length > 0 ? products : FALLBACK_TREATMENT_PRODUCTS;
  const forWelcome = mergeIntakeAndProfileDemographics(
    draftRow?.data as IntakeDraftData | undefined,
    profile?.demographics as IntakeDraftData | undefined,
  );
  const welcomeName = patientWelcomeName(user, forWelcome);
  const email = user.email ?? user.id;
  const olaUserGuid =
    bookingOlaRows?.[0]?.ola_user_guid ?? appointmentOlaRows?.[0]?.ola_user_guid ?? null;

  return (
    <PatientHubWorkspace
      appointments={appointments}
      bookingIntents={bookingIntents}
      email={email}
      initialDraft={(draftRow?.data ?? null) as IntakeDraftData | null}
      initialProfile={(profile?.demographics ?? null) as IntakeDraftData | null}
      initialStep={draftRow?.step ?? "paused_before_scheduling"}
      olaUserGuid={olaUserGuid}
      patientId={user.id}
      products={visibleProducts}
      serverLoadError={error?.message ?? bookingError?.message ?? null}
      welcomeName={welcomeName}
    />
  );
}
