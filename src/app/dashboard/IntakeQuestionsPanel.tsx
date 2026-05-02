"use client";

import {
  makeQuestionKey,
  mergePreSignupQuestions,
  optionsToText,
  parseOptionsText,
  questionTypeNeedsOptions,
  type IntakeQuestion,
  type IntakeQuestionType,
} from "@/lib/intake/intakeQuestions";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";
import styles from "./dashboard.module.css";

const pageSize = 1000;
const pageStep = 10;
const questionTypes: { value: IntakeQuestionType; label: string }[] = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "yes_no", label: "Yes / No" },
  { value: "select", label: "Single Choice" },
  { value: "multi_select", label: "Multiple Choice" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
];

type QuestionForm = {
  prompt: string;
  question_key: string;
  help_text: string;
  question_type: IntakeQuestionType;
  required: boolean;
  is_active: boolean;
  position: string;
  options: string;
};

const emptyForm: QuestionForm = {
  prompt: "",
  question_key: "",
  help_text: "",
  question_type: "text",
  required: true,
  is_active: true,
  position: "10",
  options: "",
};

function isPersistedQuestion(question: IntakeQuestion): boolean {
  return !question.id.startsWith("default-");
}

function formFromQuestion(question: IntakeQuestion): QuestionForm {
  return {
    prompt: question.prompt,
    question_key: question.question_key,
    help_text: question.help_text ?? "",
    question_type: question.question_type,
    required: question.required,
    is_active: question.is_active,
    position: String(question.position),
    options: optionsToText(question.options),
  };
}

function pageForPosition(position: number): number {
  return Math.max(1, Math.floor(Math.max(position, 0) / pageSize) + 1);
}

function positionInPage(position: number): number {
  const normalized = Math.max(position, 0);
  const remainder = normalized % pageSize;
  return remainder === 0 ? pageStep : remainder;
}

function nextPositionForPage(rows: IntakeQuestion[], page: number): number {
  const pageRows = rows.filter((row) => pageForPosition(row.position) === page);
  const maxInPage = pageRows.reduce(
    (max, row) => Math.max(max, positionInPage(row.position)),
    0,
  );
  return (page - 1) * pageSize + maxInPage + pageStep;
}

async function readMessage(res: unknown): Promise<string> {
  if (res && typeof res === "object" && "message" in res) {
    const message = (res as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Could not save intake question.";
}

export function IntakeQuestionsPanel() {
  const [rows, setRows] = useState<IntakeQuestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [selectedPage, setSelectedPage] = useState(1);
  const [manualPageCount, setManualPageCount] = useState(1);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const needsOptions = questionTypeNeedsOptions(form.question_type);

  const orderedRows = useMemo(
    () => mergePreSignupQuestions(rows, { includeInactive: true }),
    [rows],
  );
  const coreRows = orderedRows.filter((row) =>
    [
      "legal_first_name",
      "legal_last_name",
      "date_of_birth",
      "gender",
      "service_state",
      "for_self",
    ].includes(row.question_key),
  );
  const maxQuestionPage = orderedRows.reduce(
    (max, row) => Math.max(max, pageForPosition(row.position)),
    1,
  );
  const pageCount = Math.max(manualPageCount, maxQuestionPage);
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const activeRows = orderedRows.filter((row) => pageForPosition(row.position) === selectedPage);
  const selectedPageRows = activeRows.filter((row) =>
    coreRows.some((core) => core.question_key === row.question_key),
  );
  const selectedCustomRows = activeRows.filter(
    (row) => !selectedPageRows.some((core) => core.question_key === row.question_key),
  );

  async function loadRows() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("intake_questions")
      .select("id, question_key, prompt, help_text, question_type, required, options, position, is_active")
      .eq("audience", "pre_signup")
      .order("position", { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setRows((data ?? []) as IntakeQuestion[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  function updateForm(update: Partial<QuestionForm>) {
    setForm((current) => ({ ...current, ...update }));
  }

  function editQuestion(question: IntakeQuestion) {
    setSelectedPage(pageForPosition(question.position));
    setEditingId(isPersistedQuestion(question) ? question.id : null);
    setForm(formFromQuestion(question));
  }

  async function moveQuestionToPage(question: IntakeQuestion, page: number) {
    const position = nextPositionForPage(orderedRows, page);
    const payload = {
      audience: "pre_signup",
      question_key: question.question_key,
      prompt: question.prompt,
      help_text: question.help_text,
      question_type: question.question_type,
      required: question.required,
      is_active: question.is_active,
      position,
      options: question.options,
    };

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const result = isPersistedQuestion(question)
        ? await supabase.from("intake_questions").update({ position }).eq("id", question.id)
        : await supabase.from("intake_questions").insert(payload);

      if (result.error) {
        throw new Error(await readMessage(result.error));
      }

      setSelectedPage(page);
      setMessage(`Moved to page ${page}.`);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move intake question.");
    } finally {
      setDraggingQuestionId(null);
      setSaving(false);
    }
  }

  function addPage() {
    const nextPage = pageCount + 1;
    setManualPageCount(nextPage);
    setSelectedPage(nextPage);
    setForm({
      ...emptyForm,
      position: String((nextPage - 1) * pageSize + pageStep),
    });
    setEditingId(null);
  }

  async function saveQuestion() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const prompt = form.prompt.trim();
      const key = form.question_key.trim() || makeQuestionKey(prompt);
      if (!prompt || !key) {
        throw new Error("Question and key are required.");
      }
      const options = needsOptions ? parseOptionsText(form.options) : [];
      if (needsOptions && form.question_key !== "service_state" && options.length === 0) {
        throw new Error("Add at least one possible answer.");
      }

      const payload = {
        audience: "pre_signup",
        question_key: key,
        prompt,
        help_text: form.help_text.trim() || null,
        question_type: form.question_type,
        required: form.required,
        is_active: form.is_active,
        position: Number.parseInt(form.position, 10) || 0,
        options,
      };

      const supabase = createClient();
      const result = editingId
        ? await supabase.from("intake_questions").update(payload).eq("id", editingId)
        : await supabase.from("intake_questions").insert(payload);

      if (result.error) {
        throw new Error(await readMessage(result.error));
      }

      setForm(emptyForm);
      setEditingId(null);
      setMessage("Saved.");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save intake question.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.workspaceCard} aria-labelledby="intake-questions-title">
      <div className={styles.workspaceHeader}>
        <div>
          <h2 id="intake-questions-title" className={styles.workspaceTitle}>
            Intake Questions
          </h2>
          <p className={styles.compactText}>Pre-signup questions shown before account creation.</p>
        </div>
        <div className={styles.workspaceHeaderActions}>
          <p className={styles.workspaceMeta}>
            {orderedRows.filter((row) => row.is_active).length} active
          </p>
          <button type="button" className={styles.smallAction} onClick={addPage}>
            Add Page
          </button>
        </div>
      </div>

      {error ? <p className={styles.inlineError}>{error}</p> : null}
      {message ? <p className={styles.inlineSuccess}>{message}</p> : null}

      <div className={styles.questionBuilder}>
        <div className={styles.questionForm}>
          <div className={styles.pageTabs} aria-label="Intake question pages">
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                className={`${styles.pageTab} ${page === selectedPage ? styles.pageTabActive : ""}`}
                onClick={() => {
                  setSelectedPage(page);
                  if (!editingId) {
                    updateForm({ position: String(nextPositionForPage(orderedRows, page)) });
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const questionId = event.dataTransfer.getData("text/plain") || draggingQuestionId;
                  const question = orderedRows.find((row) => row.id === questionId);
                  if (question) {
                    void moveQuestionToPage(question, page);
                  }
                }}
              >
                Page {page}
                <small>{orderedRows.filter((row) => pageForPosition(row.position) === page).length}</small>
              </button>
            ))}
          </div>
          <label className={styles.adminField}>
            Question
            <input
              value={form.prompt}
              onChange={(event) => {
                const prompt = event.target.value;
                updateForm({
                  prompt,
                  question_key: form.question_key ? form.question_key : makeQuestionKey(prompt),
                });
              }}
            />
          </label>
          <div className={styles.questionFormGrid}>
            <label className={styles.adminField}>
              Key
              <input
                value={form.question_key}
                onChange={(event) => updateForm({ question_key: makeQuestionKey(event.target.value) })}
              />
            </label>
            <label className={styles.adminField}>
              Type
              <select
                value={form.question_type}
                onChange={(event) =>
                  updateForm({ question_type: event.target.value as IntakeQuestionType })
                }
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.adminField}>
              Sort
              <input
                type="number"
                value={form.position}
                onChange={(event) => updateForm({ position: event.target.value })}
              />
            </label>
          </div>
          <label className={styles.adminField}>
            Help Text
            <input
              value={form.help_text}
              onChange={(event) => updateForm({ help_text: event.target.value })}
            />
          </label>
          {needsOptions ? (
            <label className={styles.adminField}>
              Possible Answers
              <textarea
                value={form.options}
                onChange={(event) => updateForm({ options: event.target.value })}
                placeholder={"Yes\nNo\nPrefer Not To Say"}
              />
              <small className={styles.compactText}>
                One answer per line. Stored values are generated automatically.
              </small>
            </label>
          ) : null}
          <div className={styles.inlineControls}>
            <label>
              <input
                type="checkbox"
                checked={form.required}
                onChange={(event) => updateForm({ required: event.target.checked })}
              />
              Required
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => updateForm({ is_active: event.target.checked })}
              />
              Active
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => void saveQuestion()} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Question"}
            </button>
            {editingId ? (
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.questionList}>
          {loading ? <p className={styles.emptyText}>Loading questions...</p> : null}
          <div className={styles.questionListHeader}>
            <span>Page {selectedPage}</span>
            <small>Drag questions onto another page tab or use Move.</small>
          </div>
          <div className={styles.questionGroup}>
            <p className={styles.questionGroupTitle}>Core Patient Details</p>
            {selectedPageRows.length === 0 ? (
              <p className={styles.emptyText}>No core questions on this page.</p>
            ) : null}
            {selectedPageRows.map((question) => (
              <div
                key={question.id}
                role="button"
                tabIndex={0}
                className={styles.questionRow}
                draggable
                onDragStart={(event) => {
                  setDraggingQuestionId(question.id);
                  event.dataTransfer.setData("text/plain", question.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDraggingQuestionId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    editQuestion(question);
                  }
                }}
                onClick={() => editQuestion(question)}
              >
                <span>
                  <strong>{question.prompt}</strong>
                  <small>{question.question_type.replace("_", " ")} · {question.question_key}</small>
                </span>
                <span className={styles.questionRowActions}>
                  <select
                    value={pageForPosition(question.position)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => void moveQuestionToPage(question, Number(event.target.value))}
                  >
                    {pages.map((page) => (
                      <option key={page} value={page}>
                        Page {page}
                      </option>
                    ))}
                  </select>
                  <em>{question.is_active ? "Active" : "Off"}</em>
                </span>
              </div>
            ))}
          </div>
          <div className={styles.questionGroup}>
            <p className={styles.questionGroupTitle}>Additional Questions</p>
            {selectedCustomRows.length === 0 ? (
              <p className={styles.emptyText}>No additional questions on this page.</p>
            ) : null}
            {selectedCustomRows.map((question) => (
              <div
                key={question.id}
                role="button"
                tabIndex={0}
                className={styles.questionRow}
                draggable
                onDragStart={(event) => {
                  setDraggingQuestionId(question.id);
                  event.dataTransfer.setData("text/plain", question.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDraggingQuestionId(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    editQuestion(question);
                  }
                }}
                onClick={() => editQuestion(question)}
              >
                <span>
                  <strong>{question.prompt}</strong>
                  <small>{question.question_type.replace("_", " ")} · {question.question_key}</small>
                </span>
                <span className={styles.questionRowActions}>
                  <select
                    value={pageForPosition(question.position)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => void moveQuestionToPage(question, Number(event.target.value))}
                  >
                    {pages.map((page) => (
                      <option key={page} value={page}>
                        Page {page}
                      </option>
                    ))}
                  </select>
                  <em>{question.is_active ? "Active" : "Off"}</em>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
