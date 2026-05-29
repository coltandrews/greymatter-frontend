import type {
  IntakeQuestion,
  IntakeQuestionAnswers,
} from "@/lib/intake/intakeQuestions";

export type TreatmentKey =
  | "retatrutide_level_5"
  | "cashmere_cream"
  | "olympus_troches"
  | "peptides"
  | "glp_1"
  | "testosterone";

const TREATMENT_KEYS: readonly TreatmentKey[] = [
  "retatrutide_level_5",
  "cashmere_cream",
  "olympus_troches",
  "peptides",
  "glp_1",
  "testosterone",
];

export type TreatmentOption = {
  key: TreatmentKey;
  name: string;
  label: string;
  summary: string;
  accent: string;
  serviceKey: string;
  priceLabel: string;
  consultationFeeCents: number;
  medicationFeeCents: number;
  billingType: "one_time" | "subscription";
  patientVisible: boolean;
};

export type TreatmentQuestionSet = {
  treatmentKey: TreatmentKey;
  source: "placeholder" | "ola";
  version: string;
  questions: IntakeQuestion[];
};

export function isTreatmentKey(value: string | null | undefined): value is TreatmentKey {
  return TREATMENT_KEYS.includes(value as TreatmentKey);
}

function option(value: string, label = value) {
  return { value, label };
}

function question(
  treatmentKey: TreatmentKey,
  position: number,
  question_key: string,
  prompt: string,
  question_type: IntakeQuestion["question_type"],
  options: IntakeQuestion["options"] = [],
  required = true,
  help_text: string | null = null,
): IntakeQuestion {
  return {
    id: `${treatmentKey}-${question_key}`,
    question_key,
    prompt,
    help_text,
    question_type,
    required,
    options,
    position,
    is_active: true,
  };
}

export const TREATMENTS: TreatmentOption[] = [
  {
    key: "retatrutide_level_5",
    name: "Retatrutide (Level 5)",
    label: "Advanced metabolic provider review",
    summary:
      "Provider-reviewed request for retatrutide-based metabolic care. Retatrutide is investigational and eligibility is determined by a licensed clinician.",
    accent: "R",
    serviceKey: "Retatrutide (Level 5)",
    priceLabel: "Retatrutide consultation and medication review",
    consultationFeeCents: 9900,
    medicationFeeCents: 39900,
    billingType: "one_time",
    patientVisible: true,
  },
  {
    key: "cashmere_cream",
    name: "Cashmere Cream",
    label: "Prescription topical skin review",
    summary:
      "Provider-reviewed request for a compounded topical cream commonly positioned for texture, tone, firmness, and photoaging concerns.",
    accent: "C",
    serviceKey: "Cashmere Cream",
    priceLabel: "Cashmere Cream consultation and prescription review",
    consultationFeeCents: 4900,
    medicationFeeCents: 12900,
    billingType: "one_time",
    patientVisible: true,
  },
  {
    key: "olympus_troches",
    name: "Olympus Troches",
    label: "Intimate wellness provider review",
    summary:
      "Provider-reviewed request for compounded sublingual troches used in intimate wellness protocols. Formula and eligibility are determined by the provider.",
    accent: "O",
    serviceKey: "Olympus Troches",
    priceLabel: "Olympus Troches consultation and prescription review",
    consultationFeeCents: 4900,
    medicationFeeCents: 19900,
    billingType: "one_time",
    patientVisible: true,
  },
  {
    key: "peptides",
    name: "Peptides",
    label: "Regeneration and recovery support",
    summary: "A consult path for peptide-based optimization protocols.",
    accent: "P",
    serviceKey: "MetaHealthRX - Oral Semaglutide Dissolvable Tablets",
    priceLabel: "Provider consult and peptide review",
    consultationFeeCents: 9900,
    medicationFeeCents: 19900,
    billingType: "one_time",
    patientVisible: false,
  },
  {
    key: "glp_1",
    name: "GLP-1",
    label: "Metabolic care plan",
    summary: "A one-time checkout path for GLP-1 eligibility, provider review, and treatment billing.",
    accent: "G",
    serviceKey: "MetaHealthRX - Oral Semaglutide Dissolvable Tablets",
    priceLabel: "GLP-1 consultation and medication review",
    consultationFeeCents: 9900,
    medicationFeeCents: 24900,
    billingType: "one_time",
    patientVisible: false,
  },
  {
    key: "testosterone",
    name: "Testosterone",
    label: "Hormone optimization",
    summary: "A consult path for testosterone therapy review and next steps.",
    accent: "T",
    serviceKey: "MetaHealthRX - Oral Semaglutide Dissolvable Tablets",
    priceLabel: "Provider consult and hormone review",
    consultationFeeCents: 9900,
    medicationFeeCents: 14900,
    billingType: "one_time",
    patientVisible: false,
  },
];

export const PATIENT_TREATMENTS = TREATMENTS.filter((treatment) => treatment.patientVisible);

const TREATMENT_QUESTION_SETS: Record<
  Exclude<TreatmentKey, "retatrutide_level_5">,
  TreatmentQuestionSet
> = {
  peptides: {
    treatmentKey: "peptides",
    source: "ola",
    version: "ola-initial-2026-05-26",
    questions: [
      question(
        "peptides",
        1000,
        "peptides_goals",
        "What are you hoping to achieve with peptide therapy?",
        "multi_select",
        [
          option("increased_energy", "Increased energy"),
          option("improved_body_composition", "Improved body composition"),
          option("better_sleep", "Better sleep"),
          option("anti_aging", "Anti-aging"),
          option("recovery_healing", "Recovery / healing"),
          option("improved_libido", "Improved libido"),
          option("other", "Other"),
        ],
      ),
      question(
        "peptides",
        1010,
        "peptides_additional_goals",
        "Are there any additional goals you hope to accomplish with peptide therapy?",
        "textarea",
      ),
      question(
        "peptides",
        1020,
        "peptides_medical_history",
        "Do you currently have or have you ever had any of the following?",
        "multi_select",
        [
          option("cancer_history", "History of, or current active, cancer of any kind"),
          option("pituitary_tumors_seizures_head_trauma", "History of pituitary tumors, seizures, or head trauma"),
          option("untreated_thyroid_liver_kidney", "Uncontrolled/untreated thyroid, liver, or kidney disease"),
          option("untreated_heart_disease", "Uncontrolled/untreated heart disease"),
          option("pregnant_planning_breastfeeding", "Pregnant, planning to become pregnant, breastfeeding, or bottle feeding with breast milk"),
          option("untreated_diabetes", "Uncontrolled/untreated diabetes"),
          option("autoimmune_disease", "Autoimmune disease"),
          option("untreated_mood_mental_health", "Uncontrolled/untreated mood disorder or mental health condition"),
          option("active_infection", "Active infection"),
          option("none", "None of the above applies"),
        ],
      ),
      question(
        "peptides",
        1030,
        "peptides_blood_pressure",
        "Please provide your blood pressure reading from the last 6 weeks:",
        "select",
        [
          option("less_than_100_50", "Less than 100/50"),
          option("100_110_50_60", "100-110/50-60"),
          option("110_120_60_70", "110-120/60-70"),
          option("120_130_70_80", "120-130/70-80"),
          option("130_140_80_90", "130-140/80-90"),
          option("140_90", "140/90"),
        ],
      ),
      question(
        "peptides",
        1040,
        "peptides_diabetic_blood_sugar_monitoring",
        "If diabetic, do you agree to monitor your blood sugar closely and report any persistent elevation in blood sugar?",
        "select",
        [
          option("yes", "Yes"),
          option("no", "No"),
          option("does_not_apply", "Does not apply to me"),
        ],
        true,
        "Certain peptides can affect blood sugar rapidly.",
      ),
      question(
        "peptides",
        1050,
        "peptides_growth_hormone_therapy",
        "Are you currently taking any growth hormone therapy?",
        "yes_no",
      ),
      question(
        "peptides",
        1060,
        "peptides_symptoms",
        "Do you have any of the following symptoms?",
        "multi_select",
        [
          option("fatigue", "Fatigue"),
          option("belly_fat", "Belly fat"),
          option("poor_sleep", "Poor sleep"),
          option("low_libido", "Low libido"),
          option("slow_recovery", "Slow recovery"),
          option("brain_fog", "Brain fog"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "peptides",
        1070,
        "peptides_symptom_severity",
        "Please describe the severity of the symptoms you selected in the previous question from 0-5.",
        "textarea",
      ),
      question(
        "peptides",
        1080,
        "peptides_pregnancy_breastfeeding",
        "Are you currently pregnant, breastfeeding, bottle feeding with breast milk, or planning pregnancy?",
        "yes_no",
      ),
      question(
        "peptides",
        1090,
        "peptides_provider_notes",
        "Is there anything else you would like to inform the doctor?",
        "textarea",
      ),
    ],
  },
  glp_1: {
    treatmentKey: "glp_1",
    source: "ola",
    version: "ola-initial-2026-05-26",
    questions: [
      question(
        "glp_1",
        1000,
        "glp_1_pregnancy_breastfeeding_status",
        "Please select any option that best describes your current pregnancy or breastfeeding status, including menstrual timing if relevant:",
        "select",
        [
          option("pregnant", "Pregnant"),
          option("breastfeeding", "Breastfeeding"),
          option("possibly_pregnant", "Possibly pregnant"),
          option("lmp_greater_than_4_weeks", "LMP > 4 weeks"),
          option("none_not_applicable", "None / Not applicable"),
        ],
      ),
      question(
        "glp_1",
        1010,
        "glp_1_ethnicity",
        "How would you describe your ethnicity? Please select all that apply.",
        "multi_select",
        [
          option("asian", "Asian"),
          option("south_asian", "South Asian"),
          option("black_african_american", "Black or African American"),
          option("hispanic_latino", "Hispanic or Latino"),
          option("native_american", "Native American"),
          option("pacific_islander", "Pacific Islander"),
          option("white_caucasian", "White or Caucasian"),
          option("other", "Other"),
          option("prefer_not_answer", "I prefer not to answer"),
        ],
      ),
      question("glp_1", 1020, "glp_1_goal_weight", "Please enter your goal weight:", "number"),
      question(
        "glp_1",
        1030,
        "glp_1_previous_weight_loss_attempts",
        "Have you had any previous weight loss attempts? If so, which methods have you tried?",
        "multi_select",
        [
          option("diet_exercise", "Diet & Exercise"),
          option("phentermine", "Phentermine"),
          option("keto", "Keto"),
          option("low_carb", "Low-Carb"),
          option("fasting", "Fasting"),
          option("bariatric_surgery", "Bariatric Surgery"),
          option("other", "Other"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "glp_1",
        1040,
        "glp_1_prior_medication_status",
        "Are you currently or have you ever taken a GLP-1 medication?",
        "select",
        [
          option("currently_taking", "I am currently taking a GLP-1 medication"),
          option("taken_in_past", "I've taken a GLP-1 medication in the past but I'm not currently"),
          option("never_taken", "I have never taken a GLP-1 medication"),
        ],
        true,
        "GLP-1s can include compounded semaglutide, compounded tirzepatide, Ozempic, Wegovy, Mounjaro and Zepbound.",
      ),
      question(
        "glp_1",
        1050,
        "glp_1_current_medication",
        "If you are currently taking a GLP-1 medication which one are you currently taking?",
        "select",
        [
          option("injectable_liraglutide", "Injectable liraglutide (Victoza, Saxenda)"),
          option("injectable_tirzepatide", "Injectable tirzepatide (Mounjaro, Zepbound or compounded)"),
          option("injectable_semaglutide", "Injectable semaglutide (Ozempic, Wegovy or compounded)"),
          option("oral_glp_1", "Oral GLP-1 medication"),
          option("other_glp_1", "Other GLP-1 medication"),
          option("none", "None of the above"),
        ],
      ),
      question("glp_1", 1060, "glp_1_other_current_medication", "Are you currently taking any other GLP-1 medication not mentioned in the previous question?", "textarea"),
      question(
        "glp_1",
        1070,
        "glp_1_side_effects",
        "Have you experienced any of the following side effects from GLP-1 medication?",
        "multi_select",
        [
          option("nausea", "Nausea"),
          option("vomiting", "Vomiting"),
          option("diarrhea", "Diarrhea"),
          option("constipation", "Constipation"),
          option("bloating", "Bloating"),
          option("abdominal_pain", "Abdominal pain"),
          option("fatigue", "Fatigue"),
          option("dizziness", "Dizziness"),
          option("headaches", "Headaches"),
          option("no_side_effects", "No side effects"),
          option("other", "Other"),
          option("not_applicable", "Not Applicable"),
        ],
      ),
      question("glp_1", 1080, "glp_1_other_side_effects", "Are there any other side effects you would like to mention?", "textarea"),
      question(
        "glp_1",
        1090,
        "glp_1_muscle_loss",
        "Have you experienced muscle loss while taking GLP-1?",
        "select",
        [
          option("yes", "Yes"),
          option("no", "No"),
          option("unknown", "I don't know"),
          option("does_not_apply", "Does not apply"),
        ],
      ),
      question(
        "glp_1",
        1100,
        "glp_1_experience_success",
        "How successful has your GLP-1 experience been?",
        "select",
        [
          option("very_successful", "Very, I lost weight and kept it off"),
          option("somewhat_successful", "Somewhat, I lost weight but gained some back"),
          option("not_successful", "Not successful, I didn't lose much weight"),
          option("hard_staying_consistent", "It was hard staying consistent"),
          option("none_not_applicable", "None/Not applicable"),
        ],
      ),
      question(
        "glp_1",
        1110,
        "glp_1_current_dose_satisfaction",
        "Are you happy with your current GLP-1 dose?",
        "select",
        [
          option("yes_increase_if_available", "Yes, but I would like to increase my dose if higher doses are available and it's okay for me"),
          option("yes_keep_current", "Yes, I want to keep my current dose"),
          option("no_decrease", "No, I want to decrease my current dose"),
          option("not_applicable", "Not Applicable"),
        ],
      ),
      question(
        "glp_1",
        1120,
        "glp_1_medical_conditions",
        "Do you have, or have you ever had, any of the following?",
        "multi_select",
        [
          option("type_1_diabetes", "Type 1 Diabetes"),
          option("type_2_diabetes", "Type 2 Diabetes"),
          option("prediabetes", "Prediabetes"),
          option("high_blood_pressure", "High Blood Pressure"),
          option("high_cholesterol", "High Cholesterol"),
          option("heart_disease", "Heart Disease"),
          option("stroke", "Stroke"),
          option("thyroid_disease", "Thyroid Disease"),
          option("liver_disease", "Liver Disease"),
          option("kidney_disease", "Kidney Disease"),
          option("pancreatitis", "Pancreatitis"),
          option("gallbladder_issues", "Gallbladder Issues"),
          option("gastrointestinal_disorders", "Gastrointestinal Disorders"),
          option("gerd", "GERD"),
          option("severe_constipation", "Severe Constipation"),
          option("stomach_ulcers", "Stomach Ulcers"),
          option("cancer", "Cancer"),
          option("eating_disorder", "Eating Disorder (past or present)"),
          option("depression_anxiety", "Depression/Anxiety"),
          option("psychiatric_disorders", "Psychiatric Disorders"),
          option("drug_alcohol_abuse_history", "Drug or Alcohol Abuse History"),
          option("glaucoma", "Glaucoma"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "glp_1",
        1130,
        "glp_1_mental_health_conditions",
        "If you checked Depression/Anxiety or Psychiatric Disorders, have you been diagnosed with any of the following mental health conditions?",
        "multi_select",
        [
          option("major_depression", "Major Depression"),
          option("generalized_anxiety", "Generalized anxiety"),
          option("bipolar_disorder", "Bipolar disorder (manic depression)"),
          option("panic_attack", "Panic attack"),
          option("psychiatric_hospitalization_recent", "Psychiatric hospitalization within the last 3 months"),
          option("borderline_personality_disorder", "Borderline personality disorder"),
          option("psychosis", "Psychosis"),
          option("schizophrenia_schizoaffective", "Schizophrenia or schizoaffective disorder"),
          option("not_applicable", "Not Applicable"),
        ],
      ),
      question(
        "glp_1",
        1140,
        "glp_1_stable_in_treatment",
        "Are you stable in treatment?",
        "select",
        [
          option("yes", "Yes"),
          option("no", "No"),
          option("does_not_apply", "Does not apply"),
        ],
      ),
      question("glp_1", 1150, "glp_1_cancer_details", "If you selected cancer, what specific cancer have you been diagnosed with?", "textarea"),
      question(
        "glp_1",
        1160,
        "glp_1_future_chemo_or_surgery",
        "Are you planning to undergo chemotherapy or surgical treatment in the future, other than surgery to remove melanoma from the skin?",
        "select",
        [
          option("yes", "Yes"),
          option("no", "No"),
          option("does_not_apply", "Does not apply"),
        ],
      ),
      question("glp_1", 1170, "glp_1_liver_disease_details", "If you selected liver disease, have you been diagnosed with liver conditions? Fatty liver, cirrhosis, hepatitis, or something else?", "textarea"),
      question(
        "glp_1",
        1180,
        "glp_1_family_conditions",
        "Have you or a family member ever been diagnosed with any of the following conditions?",
        "multi_select",
        [
          option("medullary_thyroid_cancer", "Medullary thyroid cancer"),
          option("multiple_endocrine_neoplasia_type_2", "Multiple endocrine neoplasia type-2"),
          option("pancreatitis", "Pancreatitis"),
          option("gastroparesis", "Gastroparesis (delayed stomach emptying)"),
          option("diabetes_type_2", "Diabetes type 2"),
          option("long_qt_syndrome", "Long QT syndrome"),
          option("none", "No, none of these"),
        ],
      ),
      question("glp_1", 1190, "glp_1_supplements", "What supplements are you taking?", "textarea"),
      question(
        "glp_1",
        1200,
        "glp_1_alcohol_frequency",
        "How often do you drink alcohol?",
        "select",
        [
          option("never", "Never"),
          option("occasionally", "Occasionally"),
          option("frequently", "Frequently"),
        ],
      ),
      question("glp_1", 1210, "glp_1_nicotine_use", "Do you smoke or use nicotine?", "yes_no"),
      question(
        "glp_1",
        1220,
        "glp_1_exercise_routine",
        "What is your current exercise routine?",
        "select",
        [
          option("light", "Light"),
          option("moderate", "Moderate"),
          option("intense", "Intense"),
          option("none", "None"),
        ],
      ),
      question(
        "glp_1",
        1230,
        "glp_1_provider_notes",
        "Do you have any further information which you would like the doctor to know? Please do not include urgent or emergent medical information here, as this is not reviewed immediately.",
        "textarea",
      ),
    ],
  },
  testosterone: {
    treatmentKey: "testosterone",
    source: "ola",
    version: "ola-initial-2026-05-26",
    questions: [
      question(
        "testosterone",
        1000,
        "testosterone_goals",
        "What are your goals for TRT treatment?",
        "multi_select",
        [
          option("boost_energy", "Boost energy"),
          option("increase_libido_sexual_performance", "Increase libido / sexual performance"),
          option("increase_muscle_body_composition", "Increase muscle mass / improve body composition"),
          option("improve_mood", "Improve mood"),
        ],
      ),
      question(
        "testosterone",
        1010,
        "testosterone_symptom_onset",
        "When did your symptoms begin?",
        "select",
        [
          option("less_than_6_months", "Less than 6 months ago"),
          option("6_12_months", "6-12 months ago"),
          option("more_than_1_year", "More than 1 year ago"),
        ],
      ),
      question(
        "testosterone",
        1020,
        "testosterone_daily_activity_impact",
        "How often do these symptoms affect your daily activities?",
        "select",
        [
          option("very_frequently", "Very frequently"),
          option("occasionally", "Occasionally"),
          option("rarely", "Rarely"),
        ],
      ),
      question(
        "testosterone",
        1030,
        "testosterone_low_t_diagnosis",
        "Have you been diagnosed with low testosterone or hypogonadism?",
        "select",
        [
          option("yes", "Yes"),
          option("no", "No"),
          option("unsure", "Unsure"),
        ],
      ),
      question("testosterone", 1040, "testosterone_family_planning_12_months", "Are you planning to start a family within the next 12 months?", "yes_no"),
      question(
        "testosterone",
        1050,
        "testosterone_medical_history",
        "Do you currently have or have you ever had any of the following?",
        "multi_select",
        [
          option("prostate_cancer_elevated_psa", "Prostate cancer or elevated PSA"),
          option("breast_cancer", "Breast cancer"),
          option("pituitary_tumor", "Pituitary tumor"),
          option("heart_attack_stroke_12_months", "Heart attack or stroke within the last 12 months"),
          option("blood_clotting_disorder", "Blood/clotting disorder"),
          option("untreated_sleep_apnea", "Untreated sleep apnea"),
          option("liver_disease", "Liver disease"),
          option("uncontrolled_high_blood_pressure", "Uncontrolled high blood pressure"),
          option("untreated_thyroid_disorder", "Untreated thyroid disorder"),
          option("untreated_mental_health_condition", "Untreated mental health condition"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "testosterone",
        1060,
        "testosterone_prior_hormone_medications",
        "Have you used TRT or hormone-related medications before?",
        "multi_select",
        [
          option("testosterone_therapy", "Testosterone therapy"),
          option("clomiphene_enclomiphene", "Clomiphene / Enclomiphene"),
          option("hcg", "HCG"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "testosterone",
        1070,
        "testosterone_prior_effectiveness",
        "If you have used TRT medications before, how effective were they?",
        "select",
        [
          option("very_effective", "Very effective"),
          option("moderately_effective", "Moderately effective"),
          option("not_effective", "Not effective"),
          option("do_not_remember", "Do not remember"),
          option("not_applicable", "N/A"),
        ],
      ),
      question("testosterone", 1080, "testosterone_currently_taking_therapy", "Are you currently taking testosterone therapy?", "yes_no", [], true, "Current medication details (name, dose, frequency, last dose) can be included below."),
      question("testosterone", 1090, "testosterone_current_medications_supplements", "Please list all current medications and supplements:", "textarea"),
      question("testosterone", 1100, "testosterone_provider_notes", "Is there anything else you would like your provider to know?", "textarea"),
      question(
        "testosterone",
        1110,
        "testosterone_risk_benefit_consent",
        "Do you understand the risks and benefits of TRT and consent to treatment if prescribed?",
        "select",
        [option("yes_i_agree", "Yes, I Agree")],
      ),
    ],
  },
  cashmere_cream: {
    treatmentKey: "cashmere_cream",
    source: "ola",
    version: "ola-initial-2026-05-29",
    questions: [
      question(
        "cashmere_cream",
        1000,
        "cashmere_goals",
        "What are your goals for Cashmere Cream?",
        "multi_select",
        [
          option("texture", "Improve skin texture"),
          option("firmness", "Support firmness or elasticity"),
          option("fine_lines", "Reduce the appearance of fine lines"),
          option("uneven_tone", "Improve uneven tone or photoaging concerns"),
          option("crepey_skin", "Address crepey-looking skin"),
          option("other", "Other"),
        ],
      ),
      question(
        "cashmere_cream",
        1010,
        "cashmere_treatment_areas",
        "Which areas are you hoping to treat?",
        "multi_select",
        [
          option("face_neck", "Face or neck"),
          option("chest", "Chest"),
          option("arms", "Arms"),
          option("abdomen", "Abdomen"),
          option("legs", "Legs"),
          option("hands", "Hands"),
          option("other", "Other"),
        ],
      ),
      question(
        "cashmere_cream",
        1020,
        "cashmere_pregnancy_status",
        "Are you currently pregnant, breastfeeding, or planning pregnancy?",
        "yes_no",
      ),
      question(
        "cashmere_cream",
        1030,
        "cashmere_skin_history",
        "Do you have any of the following skin history or sensitivities?",
        "multi_select",
        [
          option("retinoid_sensitivity", "Sensitivity to retinoids or tretinoin"),
          option("eczema_rosacea", "Eczema, rosacea, or very sensitive skin"),
          option("recent_procedure", "Recent laser, peel, microneedling, or resurfacing procedure"),
          option("active_irritation", "Active rash, irritation, open skin, or infection"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "cashmere_cream",
        1040,
        "cashmere_current_topicals",
        "Please list prescription creams, retinoids, acne medications, exfoliating acids, or skin treatments you currently use.",
        "textarea",
      ),
      question(
        "cashmere_cream",
        1050,
        "cashmere_allergies",
        "Please list any medication, skin-care, or topical allergies.",
        "textarea",
      ),
      question(
        "cashmere_cream",
        1060,
        "cashmere_provider_notes",
        "Is there anything else you would like the provider to know?",
        "textarea",
        [],
        false,
      ),
      question(
        "cashmere_cream",
        1070,
        "cashmere_off_label_acknowledgement",
        "Do you understand this prescription topical may be compounded or used off-label, and that the provider will determine whether it is appropriate for you?",
        "select",
        [option("yes_i_agree", "Yes, I agree")],
      ),
    ],
  },
  olympus_troches: {
    treatmentKey: "olympus_troches",
    source: "ola",
    version: "ola-initial-2026-05-29",
    questions: [
      question(
        "olympus_troches",
        1000,
        "olympus_goals",
        "What are your goals for Olympus Troches?",
        "multi_select",
        [
          option("libido", "Support libido or desire"),
          option("arousal", "Support arousal or sensitivity"),
          option("performance", "Support sexual performance"),
          option("orgasm", "Support orgasm quality"),
          option("performance_anxiety", "Reduce performance anxiety"),
          option("intimacy", "Support intimacy or connection"),
          option("other", "Other"),
        ],
      ),
      question(
        "olympus_troches",
        1010,
        "olympus_symptom_duration",
        "How long have these concerns been present?",
        "select",
        [
          option("less_than_3_months", "Less than 3 months"),
          option("3_to_12_months", "3-12 months"),
          option("more_than_12_months", "More than 12 months"),
          option("not_applicable", "Not applicable"),
        ],
      ),
      question(
        "olympus_troches",
        1020,
        "olympus_medical_history",
        "Do you currently have or have you ever had any of the following?",
        "multi_select",
        [
          option("nitrate_medications", "Use of nitrate medications or nitric oxide donors"),
          option("heart_disease", "Heart disease, chest pain, heart attack, or stroke"),
          option("uncontrolled_blood_pressure", "Uncontrolled high or low blood pressure"),
          option("fainting_dizziness", "Frequent fainting, severe dizziness, or lightheadedness"),
          option("pregnant_breastfeeding", "Pregnant, breastfeeding, or planning pregnancy"),
          option("severe_liver_kidney_disease", "Severe liver or kidney disease"),
          option("none", "None of the above"),
        ],
      ),
      question(
        "olympus_troches",
        1030,
        "olympus_current_medications",
        "Please list all current medications and supplements, including blood pressure medications, ED medications, nitrates, or hormone therapies.",
        "textarea",
      ),
      question(
        "olympus_troches",
        1040,
        "olympus_side_effect_history",
        "Have you previously had side effects with tadalafil, sildenafil, bremelanotide/PT-141, oxytocin, or similar medications?",
        "textarea",
      ),
      question(
        "olympus_troches",
        1050,
        "olympus_provider_notes",
        "Is there anything else you would like the provider to know?",
        "textarea",
        [],
        false,
      ),
      question(
        "olympus_troches",
        1060,
        "olympus_off_label_acknowledgement",
        "Do you understand this medication may be compounded or used off-label, and that the provider will determine whether it is appropriate for you?",
        "select",
        [option("yes_i_agree", "Yes, I agree")],
      ),
    ],
  },
};

export function treatmentByKey(key: string | null | undefined): TreatmentOption | null {
  return TREATMENTS.find((treatment) => treatment.key === key) ?? null;
}

export function treatmentQuestionSet(key: TreatmentKey | null): TreatmentQuestionSet | null {
  if (!key) {
    return null;
  }
  if (key === "retatrutide_level_5") {
    const glpSet = TREATMENT_QUESTION_SETS.glp_1;
    return {
      treatmentKey: "retatrutide_level_5",
      source: glpSet.source,
      version: `${glpSet.version}-retatrutide`,
      questions: glpSet.questions.map((question) => ({
        ...question,
        id: `retatrutide_level_5-${question.question_key}`,
      })),
    };
  }
  return TREATMENT_QUESTION_SETS[key];
}

export function treatmentQuestions(key: TreatmentKey | null): IntakeQuestion[] {
  return treatmentQuestionSet(key)?.questions.filter((question) => question.is_active) ?? [];
}

const GLP_1_PREVIOUS_EXPERIENCE_QUESTION_KEYS = new Set([
  "glp_1_current_medication",
  "glp_1_other_current_medication",
  "glp_1_side_effects",
  "glp_1_other_side_effects",
  "glp_1_muscle_loss",
  "glp_1_experience_success",
  "glp_1_current_dose_satisfaction",
]);

const GLP_1_CURRENT_MEDICATION_QUESTION_KEYS = new Set([
  "glp_1_current_medication",
  "glp_1_other_current_medication",
  "glp_1_current_dose_satisfaction",
]);

const GLP_1_MENTAL_HEALTH_MEDICAL_CONDITION_VALUES = new Set([
  "depression_anxiety",
  "psychiatric_disorders",
]);

const GLP_1_CANCER_FOLLOW_UP_QUESTION_KEYS = new Set([
  "glp_1_cancer_details",
  "glp_1_future_chemo_or_surgery",
]);

const GLP_1_LIVER_DISEASE_FOLLOW_UP_QUESTION_KEYS = new Set([
  "glp_1_liver_disease_details",
]);

function answerValues(value: IntakeQuestionAnswers[string] | undefined): string[] {
  return Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
}

function filterQuestionKeys(
  questions: IntakeQuestion[],
  hiddenQuestionKeys: Set<string>,
): IntakeQuestion[] {
  return questions.filter((question) => !hiddenQuestionKeys.has(question.question_key));
}

export function visibleTreatmentQuestions(
  key: TreatmentKey | null,
  answers: IntakeQuestionAnswers = {},
): IntakeQuestion[] {
  let questions = treatmentQuestions(key);
  if (key !== "glp_1" && key !== "retatrutide_level_5") {
    return questions;
  }

  const priorMedicationStatus = answers.glp_1_prior_medication_status;
  if (priorMedicationStatus === "never_taken") {
    questions = questions.filter(
      (question) => !GLP_1_PREVIOUS_EXPERIENCE_QUESTION_KEYS.has(question.question_key),
    );
  }

  if (priorMedicationStatus === "taken_in_past") {
    questions = questions.filter(
      (question) => !GLP_1_CURRENT_MEDICATION_QUESTION_KEYS.has(question.question_key),
    );
  }

  const medicalConditions = answerValues(answers.glp_1_medical_conditions);
  const hasMentalHealthCondition = medicalConditions.some((value) =>
    GLP_1_MENTAL_HEALTH_MEDICAL_CONDITION_VALUES.has(value),
  );
  if (!hasMentalHealthCondition) {
    questions = questions.filter(
      (question) =>
        question.question_key !== "glp_1_mental_health_conditions" &&
        question.question_key !== "glp_1_stable_in_treatment",
    );
  }

  const mentalHealthConditions = answerValues(answers.glp_1_mental_health_conditions);
  if (mentalHealthConditions.includes("not_applicable")) {
    questions = questions.filter(
      (question) => question.question_key !== "glp_1_stable_in_treatment",
    );
  }

  if (!medicalConditions.includes("cancer")) {
    questions = filterQuestionKeys(questions, GLP_1_CANCER_FOLLOW_UP_QUESTION_KEYS);
  }

  if (!medicalConditions.includes("liver_disease")) {
    questions = filterQuestionKeys(questions, GLP_1_LIVER_DISEASE_FOLLOW_UP_QUESTION_KEYS);
  }

  return questions;
}
