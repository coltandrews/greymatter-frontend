/**
 * Appointment-specific intake (not health/eligibility intake).
 * Replace this module with DB- or admin-driven config later.
 */
export type AppointmentQuestion =
  | {
      id: string;
      type: "select";
      label: string;
      required: boolean;
      options: { value: string; label: string }[];
    }
  | {
      id: string;
      type: "textarea";
      label: string;
      required: boolean;
      placeholder?: string;
    };

export const APPOINTMENT_QUESTIONS: AppointmentQuestion[] = [
  {
    id: "chief_concern",
    type: "select",
    label: "What is the main reason for this visit?",
    required: true,
    options: [
      { value: "follow_up", label: "Follow-up on existing care" },
      { value: "new_concern", label: "New symptom or concern" },
      { value: "medication", label: "Medication question" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "visit_format",
    type: "select",
    label: "Preferred visit format",
    required: true,
    options: [
      { value: "video", label: "Video visit" },
      { value: "phone", label: "Phone visit" },
    ],
  },
  {
    id: "additional_notes",
    type: "textarea",
    label: "Anything else we should know? (optional)",
    required: false,
    placeholder: "e.g. preferred callback window, allergies to mention…",
  },
];
