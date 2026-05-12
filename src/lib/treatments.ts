import type { IntakeQuestion } from "@/lib/intake/intakeQuestions";

export type TreatmentKey = "peptides" | "glp_1" | "testosterone";

export type TreatmentOption = {
  key: TreatmentKey;
  name: string;
  label: string;
  summary: string;
  accent: string;
  serviceKey: string;
  priceLabel: string;
};

export type TreatmentQuestionSet = {
  treatmentKey: TreatmentKey;
  source: "placeholder" | "ola";
  version: string;
  questions: IntakeQuestion[];
};

export const TREATMENTS: TreatmentOption[] = [
  {
    key: "peptides",
    name: "Peptides",
    label: "Regeneration and recovery support",
    summary: "A consult path for peptide-based optimization protocols.",
    accent: "P",
    serviceKey: "MetaHealthRX - Oral Semaglutide Dissolvable Tablets",
    priceLabel: "Provider consult and treatment review",
  },
  {
    key: "glp_1",
    name: "GLP-1",
    label: "Metabolic and weight management",
    summary: "A consult path for GLP-1 medication eligibility and care planning.",
    accent: "G",
    serviceKey: "MetaHealthRX - Oral Semaglutide Dissolvable Tablets",
    priceLabel: "Provider consult and GLP-1 review",
  },
  {
    key: "testosterone",
    name: "Testosterone",
    label: "Hormone optimization",
    summary: "A consult path for testosterone therapy review and next steps.",
    accent: "T",
    serviceKey: "MetaHealthRX - Oral Semaglutide Dissolvable Tablets",
    priceLabel: "Provider consult and hormone review",
  },
];

export const TREATMENT_QUESTION_SETS: Record<TreatmentKey, TreatmentQuestionSet> = {
  peptides: {
    treatmentKey: "peptides",
    source: "placeholder",
    version: "placeholder-2026-05-11",
    questions: [{
      id: "peptides-primary-goal",
      question_key: "peptides_primary_goal",
      prompt: "What is your primary goal for peptide treatment?",
      help_text: null,
      question_type: "textarea",
      required: true,
      options: [],
      position: 1000,
      is_active: true,
    },
    {
      id: "peptides-current-protocol",
      question_key: "peptides_current_protocol",
      prompt: "Are you currently using any peptides or performance therapies?",
      help_text: null,
      question_type: "yes_no",
      required: true,
      options: [],
      position: 1010,
      is_active: true,
    }],
  },
  glp_1: {
    treatmentKey: "glp_1",
    source: "placeholder",
    version: "placeholder-2026-05-11",
    questions: [{
      id: "glp-1-current-weight",
      question_key: "glp_1_current_weight",
      prompt: "What is your current weight?",
      help_text: null,
      question_type: "text",
      required: true,
      options: [],
      position: 1000,
      is_active: true,
    },
    {
      id: "glp-1-prior-use",
      question_key: "glp_1_prior_use",
      prompt: "Have you used a GLP-1 medication before?",
      help_text: null,
      question_type: "yes_no",
      required: true,
      options: [],
      position: 1010,
      is_active: true,
    }],
  },
  testosterone: {
    treatmentKey: "testosterone",
    source: "placeholder",
    version: "placeholder-2026-05-11",
    questions: [{
      id: "testosterone-symptoms",
      question_key: "testosterone_symptoms",
      prompt: "Which symptoms are you looking to address?",
      help_text: null,
      question_type: "multi_select",
      required: true,
      options: [
        { value: "low_energy", label: "Low energy" },
        { value: "low_libido", label: "Low libido" },
        { value: "strength", label: "Strength or body composition" },
        { value: "mood", label: "Mood or focus" },
      ],
      position: 1000,
      is_active: true,
    },
    {
      id: "testosterone-recent-labs",
      question_key: "testosterone_recent_labs",
      prompt: "Have you had testosterone labs in the last 12 months?",
      help_text: null,
      question_type: "yes_no",
      required: true,
      options: [],
      position: 1010,
      is_active: true,
    }],
  },
};

export function treatmentByKey(key: string | null | undefined): TreatmentOption | null {
  return TREATMENTS.find((treatment) => treatment.key === key) ?? null;
}

export function treatmentQuestionSet(key: TreatmentKey | null): TreatmentQuestionSet | null {
  return key ? TREATMENT_QUESTION_SETS[key] : null;
}

export function treatmentQuestions(key: TreatmentKey | null): IntakeQuestion[] {
  return treatmentQuestionSet(key)?.questions.filter((question) => question.is_active) ?? [];
}
