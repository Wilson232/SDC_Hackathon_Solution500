import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileCheck2,
  FileText,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import "./certificates.css";

type CourseStep = {
  id: string;
  title: string;
  skillCovered?: string;
  [key: string]: unknown;
};

type CertificateFile = {
  id: string;
  courseId: string;
  filename: string;
  mime: string;
  size: number;
  checked: boolean;
};

type CertificatePlan = {
  id: string | number;
  careerKey: string;
  careerTitle: string;
  courses: CourseStep[];
  status: "draft" | "pending" | "approved" | "rejected";
  reviewNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  awardedRole?: string | null;
  certificates: CertificateFile[];
  owner?: { email?: string };
};

type CareerRole = {
  id: string;
  title: string;
  pathway: CourseStep[];
};

type ApiError = { error?: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please try again.`;
    try {
      const body = (await response.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      // Keep the readable fallback when the server does not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function certificateFor(plan: CertificatePlan, courseId: string) {
  return plan.certificates?.find((file) => file.courseId === courseId);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date?: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(status: CertificatePlan["status"]) {
  return {
    draft: "In progress",
    pending: "Awaiting review",
    approved: "Reviewed and approved",
    rejected: "Changes requested",
  }[status];
}

function StatusPill({ status }: { status: CertificatePlan["status"] }) {
  const Icon =
    status === "approved"
      ? CheckCircle2
      : status === "pending"
        ? Clock3
        : status === "rejected"
          ? AlertCircle
          : FileText;
  return (
    <span className={`cert-status cert-status--${status}`}>
      <Icon size={15} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

function ErrorMessage({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className="cert-alert cert-alert--error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{children}</span>
      {onDismiss && (
        <button className="cert-icon-button cert-alert__dismiss" type="button" onClick={onDismiss} aria-label="Dismiss error">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function CertificateWorkflow({
  role,
  renderLearningOptions,
  planId,
}: {
  role: CareerRole;
  renderLearningOptions: (step: CourseStep) => React.ReactNode;
  planId?: string;
}) {
  const [plan, setPlan] = useState<CertificatePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyCourse, setBusyCourse] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [retryIndex, setRetryIndex] = useState(0);
  const generation = useRef(0);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [draggingCourse, setDraggingCourse] = useState<string | null>(null);

  const canEdit = plan?.status === "draft" || plan?.status === "rejected";
  const pathwaySignature = role.pathway.map((step) => `${step.id}:${step.title}:${step.skillCovered || ""}`).join("|");

  const loadPlan = useCallback(async (quiet = false) => {
    const currentGeneration = generation.current;
    if (!plan?.id) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const updated = await request<CertificatePlan>(`/api/certificate-plans/${encodeURIComponent(String(plan.id))}`);
      if (generation.current !== currentGeneration) return;
      setPlan(updated);
    } catch (err) {
      if (generation.current !== currentGeneration) return;
      setError(err instanceof Error ? err.message : "Could not refresh the certificate plan.");
    } finally {
      if (generation.current === currentGeneration) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [plan?.id]);

  useEffect(() => {
    const token = ++generation.current;
    let active = true;
    setPlan(null);
    setLoading(true);
    setError("");
    setNotice("");
    setBusyCourse(null);
    setExpandedCourse(null);
    setDraggingCourse(null);
    const courses = role.pathway.map(({ id, title, skillCovered }) => ({ id, title, skillCovered }));

    request<CertificatePlan>(planId ? `/api/certificate-plans/${encodeURIComponent(planId)}` : "/api/certificate-plans", planId ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ careerKey: role.id, careerTitle: role.title, courses }),
    })
      .then((created) => {
        if (!active || generation.current !== token) return;
        setPlan(created);
        return request<CertificatePlan>(`/api/certificate-plans/${encodeURIComponent(String(created.id))}`)
          .then((fresh) => {
            if (active && generation.current === token) setPlan(fresh);
          });
      })
      .catch((err: unknown) => {
        if (!active || generation.current !== token) return;
        setError(err instanceof Error ? err.message : "Could not load your certificate plan.");
      })
      .finally(() => {
        if (active && generation.current === token) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role.id, role.title, pathwaySignature, retryIndex, planId]);

  useEffect(() => {
    if (plan?.status !== "pending") return;
    const timer = window.setInterval(() => void loadPlan(true), 15_000);
    return () => window.clearInterval(timer);
  }, [loadPlan, plan?.status]);

  const performFileAction = async (courseId: string, file: File | null) => {
    if (!plan || !canEdit) return;
    setError("");
    setNotice("");
    if (file) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(extension)) {
        setError("Choose a PDF, PNG or JPEG certificate.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("That file is larger than 5 MB. Choose a smaller certificate.");
        return;
      }
      if (file.size === 0) {
        setError("That file appears to be empty. Choose another certificate.");
        return;
      }
    }
    const currentGeneration = generation.current;
    setBusyCourse(courseId);
    try {
      const endpoint = `/api/certificate-plans/${encodeURIComponent(String(plan.id))}/courses/${encodeURIComponent(courseId)}/certificate`;
      let updated: CertificatePlan;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        updated = await request<CertificatePlan>(endpoint, { method: "PUT", body: formData });
        if (certificateFor(updated, courseId)?.checked) {
          updated = await request<CertificatePlan>(
            `/api/certificate-plans/${encodeURIComponent(String(plan.id))}/courses/${encodeURIComponent(courseId)}/checked`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checked: false }),
            },
          );
        }
      } else {
        updated = await request<CertificatePlan>(endpoint, { method: "DELETE" });
      }
      if (generation.current !== currentGeneration) return;
      setPlan(updated);
      setNotice(file ? "Certificate uploaded." : "Certificate removed.");
    } catch (err) {
      if (generation.current !== currentGeneration) return;
      setError(err instanceof Error ? err.message : "The certificate could not be updated.");
    } finally {
      if (generation.current === currentGeneration) setBusyCourse(null);
    }
  };

  const toggleChecked = async (courseId: string, checked: boolean) => {
    if (!plan || !canEdit || !certificateFor(plan, courseId)) return;
    const currentGeneration = generation.current;
    setBusyCourse(courseId);
    setError("");
    setNotice("");
    try {
      const updated = await request<CertificatePlan>(
        `/api/certificate-plans/${encodeURIComponent(String(plan.id))}/courses/${encodeURIComponent(courseId)}/checked`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked }),
        },
      );
      if (generation.current === currentGeneration) setPlan(updated);
    } catch (err) {
      if (generation.current !== currentGeneration) return;
      setError(err instanceof Error ? err.message : "Your review status could not be saved.");
    } finally {
      if (generation.current === currentGeneration) setBusyCourse(null);
    }
  };

  const submitPlan = async () => {
    if (!plan || plan.status !== "draft" && plan.status !== "rejected") return;
    const ready = role.pathway.every((step) => {
      const file = certificateFor(plan, step.id);
      return Boolean(file && file.checked);
    });
    if (!ready) return;
    const confirmed = window.confirm(
      `Submit all three certificates for ${role.title} for human review? You will not be able to change them while they are being reviewed.`,
    );
    if (!confirmed) return;
    const currentGeneration = generation.current;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const updated = await request<CertificatePlan>(
        `/api/certificate-plans/${encodeURIComponent(String(plan.id))}/submit`,
        { method: "POST" },
      );
      if (generation.current === currentGeneration) setPlan(updated);
    } catch (err) {
      if (generation.current !== currentGeneration) return;
      setError(err instanceof Error ? err.message : "Your certificates could not be submitted.");
    } finally {
      if (generation.current === currentGeneration) setSubmitting(false);
    }
  };

  const allReady = Boolean(
    plan &&
      role.pathway.length === 3 &&
      role.pathway.every((step) => {
        const file = certificateFor(plan, step.id);
        return file?.checked;
      }),
  );
  const isFrozen = plan?.status === "pending" || plan?.status === "approved";

  return (
    <section className="cert-workflow" aria-labelledby="cert-workflow-title">
      <header className="cert-workflow__header">
        <div className="cert-workflow__heading">
          <span className="cert-kicker">Learning evidence</span>
          <h2 id="cert-workflow-title">Show what you’ve learned</h2>
          <p>Upload a certificate for each course. A person will review the evidence before your pathway is marked complete.</p>
        </div>
        {plan && <StatusPill status={plan.status} />}
      </header>

      {error && <ErrorMessage onDismiss={() => setError("")}>{error}</ErrorMessage>}
      <div className="cert-sr-only" aria-live="polite" aria-atomic="true">{notice}</div>

      {loading && !plan ? (
        <div className="cert-loading" aria-label="Loading your certificate pathway">
          <div className="cert-skeleton cert-skeleton--title" />
          <div className="cert-skeleton" />
          <div className="cert-skeleton" />
          <div className="cert-skeleton" />
        </div>
      ) : !plan ? (
        <div className="cert-empty" role="status">
          <AlertCircle size={22} aria-hidden="true" />
          <div>
            <strong>Your certificate plan isn’t available yet.</strong>
            <p>Check your connection and try loading the pathway again.</p>
            <button className="cert-button cert-button--secondary" type="button" onClick={() => setRetryIndex((value) => value + 1)}>
              <RefreshCw size={16} aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          {plan.status === "approved" && (
            <div className="cert-award" role="status">
              <span className="cert-award__icon"><ShieldCheck size={22} aria-hidden="true" /></span>
              <span>
                <strong>Course finished — {plan.awardedRole || role.title}</strong>
                <small>Your submitted learning evidence has been reviewed and approved.</small>
              </span>
              <CheckCircle2 className="cert-award__check" size={21} aria-hidden="true" />
            </div>
          )}

          {plan.status === "pending" && (
            <div className="cert-pending" role="status">
              <span className="cert-pending__icon"><Clock3 size={21} aria-hidden="true" /></span>
              <div>
                <strong>Your evidence is with our review team</strong>
                <p>We’ll notify you here in the app when a reviewer has checked each certificate.</p>
                {plan.submittedAt && <small>Submitted {formatDate(plan.submittedAt)}</small>}
              </div>
              <button
                className="cert-button cert-button--quiet cert-refresh"
                type="button"
                onClick={() => void loadPlan(true)}
                disabled={refreshing}
                aria-label="Refresh review status"
              >
                <RefreshCw size={16} className={refreshing ? "cert-spinning" : ""} aria-hidden="true" />
                <span>{refreshing ? "Refreshing" : "Refresh"}</span>
              </button>
            </div>
          )}

          {plan.status === "rejected" && (
            <div className="cert-rejected" role="status">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <strong>Your reviewer has requested a change</strong>
                <p>{plan.reviewNote || "Please check your evidence and resubmit when ready."}</p>
                {plan.reviewedAt && <small>Reviewed {formatDate(plan.reviewedAt)}</small>}
              </div>
            </div>
          )}

          <div className="cert-course-list">
            {role.pathway.map((step, index) => {
              const certificate = certificateFor(plan, step.id);
              const expanded = expandedCourse === step.id;
              const locked = !canEdit || busyCourse === step.id;
              return (
                <article className="cert-course" key={`${role.id}-${step.id}`}>
                  <div className="cert-course__top">
                    <span className="cert-course__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="cert-course__title">
                      <span className="cert-course__eyebrow">Course {index + 1} of 3</span>
                      <h3>{step.title}</h3>
                      {step.skillCovered && <p>Skill focus: {step.skillCovered}</p>}
                    </div>
                    <span className={`cert-course__evidence ${certificate ? "is-present" : ""}`}>
                      {certificate ? <Check size={14} aria-hidden="true" /> : <span className="cert-course__dot" aria-hidden="true" />}
                      {certificate ? "Evidence added" : "Evidence needed"}
                    </span>
                  </div>

                  <div className="cert-course__body">
                    <div className="cert-upload" aria-label={`Certificate evidence for ${step.title}`}>
                      <button
                        className="cert-upload__toggle"
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`cert-upload-panel-${step.id}`}
                        onClick={() => setExpandedCourse(expanded ? null : step.id)}
                      >
                        <span className="cert-upload__label">
                          {certificate ? <FileCheck2 size={18} aria-hidden="true" /> : <UploadCloud size={18} aria-hidden="true" />}
                          <span>{certificate ? "Certificate file" : "Add certificate"}</span>
                        </span>
                        {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                      </button>
                      {expanded && (
                        <div className="cert-upload__panel" id={`cert-upload-panel-${step.id}`}>
                          {certificate ? (
                            <div className="cert-file-row">
                              <span className="cert-file-row__icon"><FileText size={17} aria-hidden="true" /></span>
                              <span className="cert-file-row__details">
                                <strong title={certificate.filename}>{certificate.filename}</strong>
                                <small>{formatFileSize(certificate.size)} · {certificate.mime.replace("image/jpeg", "JPEG").replace("image/png", "PNG").replace("application/pdf", "PDF")}</small>
                              </span>
                              {plan.status !== "draft" && (
                                <a className="cert-icon-button" href={`/api/certificates/${encodeURIComponent(certificate.id)}/download`} aria-label={`Download ${certificate.filename}`}>
                                  <ArrowDownToLine size={17} aria-hidden="true" />
                                </a>
                              )}
                              {canEdit && (
                                <button
                                  className="cert-icon-button cert-icon-button--danger"
                                  type="button"
                                  onClick={() => void performFileAction(step.id, null)}
                                  disabled={locked}
                                  aria-label={`Remove ${certificate.filename}`}
                                >
                                  {busyCourse === step.id ? <LoaderCircle className="cert-spinning" size={16} /> : <Trash2 size={16} />}
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="cert-upload__hint">A completion certificate, saved as PDF, PNG or JPEG. Maximum file size: 5 MB.</p>
                          )}
                          {canEdit && (
                            <div
                              className={`cert-dropzone ${draggingCourse === step.id ? "is-dragging" : ""}`}
                              onDragEnter={(event) => { event.preventDefault(); setDraggingCourse(step.id); }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={(event) => {
                                event.preventDefault();
                                if (event.currentTarget === event.target) setDraggingCourse(null);
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                setDraggingCourse(null);
                                const file = event.dataTransfer.files[0];
                                if (file) void performFileAction(step.id, file);
                              }}
                            >
                              <input
                                ref={(node) => { fileInputs.current[step.id] = node; }}
                                className="cert-sr-only"
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                aria-label={`Choose certificate for ${step.title}`}
                                disabled={locked}
                                onChange={(event) => {
                                  const file = event.currentTarget.files?.[0];
                                  if (file) void performFileAction(step.id, file);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <UploadCloud size={20} aria-hidden="true" />
                              <span>{certificate ? "Drop a replacement here, or" : "Drop your certificate here, or"}</span>
                              <button
                                type="button"
                                className="cert-text-button"
                                disabled={locked}
                                onClick={() => fileInputs.current[step.id]?.click()}
                              >
                                browse files
                              </button>
                              {busyCourse === step.id && <span className="cert-upload__busy"><LoaderCircle className="cert-spinning" size={14} /> Uploading</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <label className={`cert-check ${certificate ? "" : "is-disabled"}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(certificate?.checked)}
                        disabled={!certificate || locked}
                        onChange={(event) => void toggleChecked(step.id, event.currentTarget.checked)}
                      />
                      <span className="cert-check__box" aria-hidden="true"><Check size={13} /></span>
                      <span>I confirm this file is my evidence of completing this course</span>
                      {busyCourse === step.id && <LoaderCircle className="cert-spinning cert-check__busy" size={15} aria-label="Saving" />}
                    </label>

                    <div className="cert-learning">
                      <span className="cert-learning__label">Learning options</span>
                      <div>{renderLearningOptions(step)}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {canEdit ? (
            <div className="cert-submit">
              <div className="cert-submit__copy">
                <strong>{allReady ? "All three certificates are ready." : "Your pathway needs three certificates."}</strong>
                <span>Tick the evidence confirmation on each uploaded file to continue.</span>
              </div>
              {allReady && <button className="cert-button cert-button--primary" type="button" onClick={() => void submitPlan()} disabled={submitting}>
                {submitting ? <LoaderCircle className="cert-spinning" size={17} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
                {submitting ? "Submitting…" : "Submit certificates"}
              </button>}
            </div>
          ) : (
            <p className="cert-locked-note">
              {isFrozen
                ? "Your files and confirmations are locked while review is in progress."
                : "These certificates have been reviewed. Your approved status is final."}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function AdminCertificateReviews() {
  const [plans, setPlans] = useState<CertificatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [attestations, setAttestations] = useState<Record<string, boolean>>({});
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await request<CertificatePlan[]>("/api/admin/submissions");
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load certificate submissions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const review = async (plan: CertificatePlan, decision: "approved" | "rejected") => {
    const id = String(plan.id);
    const note = (notes[id] || "").trim();
    if (decision === "rejected" && !note) {
      setError("Add a clear reason before requesting changes.");
      document.getElementById(`admin-review-note-${id}`)?.focus();
      return;
    }
    if (decision === "approved" && !attestations[id]) {
      setError("Confirm that you personally reviewed the submitted evidence before approving.");
      document.getElementById(`admin-attestation-${id}`)?.focus();
      return;
    }
    setBusyPlan(id);
    setError("");
    try {
      await request<CertificatePlan>(`/api/admin/submissions/${encodeURIComponent(id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      setNotes((previous) => ({ ...previous, [id]: "" }));
      setAttestations((previous) => ({ ...previous, [id]: false }));
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This submission could not be reviewed.");
    } finally {
      setBusyPlan(null);
    }
  };

  const pending = plans.filter((plan) => plan.status === "pending");
  const history = plans.filter((plan) => plan.status !== "pending");
  const shownPlans = activeTab === "pending" ? pending : history;

  return (
    <main className="cert-admin">
      <header className="cert-admin__header">
        <div>
          <span className="cert-kicker">FindMyCareer · Reviewer workspace</span>
          <h1>Certificate reviews</h1>
          <p>Check the submitted evidence before deciding whether a learner’s pathway is complete.</p>
        </div>
        <button
          className="cert-button cert-button--secondary"
          type="button"
          onClick={() => void refresh(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "cert-spinning" : ""} size={16} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && <ErrorMessage onDismiss={() => setError("")}>{error}</ErrorMessage>}

      <div className="cert-admin__tabs" role="tablist" aria-label="Submission status">
        <button type="button" role="tab" aria-selected={activeTab === "pending"} onClick={() => setActiveTab("pending")}>
          Needs review <span>{pending.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "history"} onClick={() => setActiveTab("history")}>
          Review history <span>{history.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="cert-loading" aria-label="Loading submissions">
          <div className="cert-skeleton cert-skeleton--title" />
          <div className="cert-skeleton" />
          <div className="cert-skeleton" />
        </div>
      ) : shownPlans.length === 0 ? (
        <div className="cert-admin-empty" role="status">
          <span className="cert-admin-empty__icon"><FileCheck2 size={22} aria-hidden="true" /></span>
          <strong>{activeTab === "pending" ? "Nothing waiting for review." : "No review history yet."}</strong>
          <p>{activeTab === "pending" ? "New certificate submissions will appear here." : "Completed decisions will be listed here."}</p>
        </div>
      ) : (
        <div className="cert-admin-list">
          {shownPlans.map((plan) => {
            const id = String(plan.id);
            const isPending = plan.status === "pending";
            const open = expandedPlan === id || isPending;
            return (
              <article className="cert-admin-card" key={id}>
                <button
                  className="cert-admin-card__summary"
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpandedPlan(open && !isPending ? null : id)}
                >
                  <span className="cert-admin-card__mark"><FileText size={19} aria-hidden="true" /></span>
                  <span className="cert-admin-card__identity">
                    <strong>{plan.careerTitle}</strong>
                    <small>{plan.owner?.email || "Learner"}{plan.submittedAt ? ` · Submitted ${formatDate(plan.submittedAt)}` : ""}</small>
                  </span>
                  <StatusPill status={plan.status} />
                  {open ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                </button>
                {open && (
                  <div className="cert-admin-card__content">
                    <ul className="cert-admin-files">
                      {(plan.courses || []).map((course) => {
                        const file = certificateFor(plan, course.id);
                        return (
                          <li key={course.id}>
                            <span className="cert-admin-files__course">
                              <strong>{course.title}</strong>
                              <small>{course.skillCovered || "Course evidence"}</small>
                            </span>
                            {file ? (
                              <span className="cert-admin-files__file">
                                <span className="cert-admin-files__name" title={file.filename}>
                                  <FileCheck2 size={15} aria-hidden="true" /> {file.filename}
                                </span>
                                <small>{formatFileSize(file.size)} · {file.checked ? "Learner confirmed" : "Not confirmed"}</small>
                                <a className="cert-button cert-button--secondary cert-download" href={`/api/certificates/${encodeURIComponent(file.id)}/download`}>
                                  <ArrowDownToLine size={15} aria-hidden="true" /> Download
                                </a>
                              </span>
                            ) : (
                              <span className="cert-admin-files__missing">No file found</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {isPending ? (
                      <div className="cert-review-form">
                        <label className="cert-field">
                          <span>Reviewer note <small>{activeTab === "pending" ? "Required when requesting changes" : ""}</small></span>
                          <textarea
                            id={`admin-review-note-${id}`}
                            rows={3}
                            value={notes[id] || ""}
                            onChange={(event) => { const value = event.currentTarget.value; setNotes((previous) => ({ ...previous, [id]: value })); }}
                            placeholder="Explain what the learner should review or clarify…"
                            maxLength={2000}
                          />
                        </label>
                        <label className="cert-attestation" htmlFor={`admin-attestation-${id}`}>
                          <input
                            id={`admin-attestation-${id}`}
                            type="checkbox"
                            checked={Boolean(attestations[id])}
                            onChange={(event) => { const checked = event.currentTarget.checked; setAttestations((previous) => ({ ...previous, [id]: checked })); }}
                          />
                          <span className="cert-attestation__box" aria-hidden="true"><Check size={13} /></span>
                          <span>I personally reviewed the submitted certificates. Approval is based on my human assessment of the evidence, not an automated authenticity check.</span>
                        </label>
                        <p className="cert-review-caution">Review the documents yourself. FindMyCareer does not authenticate certificates automatically. The server prevents an owner from reviewing their own submission.</p>
                        <div className="cert-review-actions">
                          <button
                            className="cert-button cert-button--secondary cert-button--reject"
                            type="button"
                            onClick={() => void review(plan, "rejected")}
                            disabled={busyPlan === id}
                          >
                            {busyPlan === id ? <LoaderCircle className="cert-spinning" size={16} /> : <X size={16} />}
                            Request changes
                          </button>
                          <button
                            className="cert-button cert-button--primary"
                            type="button"
                            onClick={() => void review(plan, "approved")}
                            disabled={busyPlan === id || !attestations[id]}
                          >
                            {busyPlan === id ? <LoaderCircle className="cert-spinning" size={16} /> : <CheckCircle2 size={16} />}
                            Approve evidence
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="cert-admin-history">
                        <StatusPill status={plan.status} />
                        {plan.reviewNote && <p><strong>Reviewer note:</strong> {plan.reviewNote}</p>}
                        {plan.reviewedAt && <small>Reviewed {formatDate(plan.reviewedAt)}</small>}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="cert-sr-only" aria-live="polite" aria-atomic="true">
        {refreshing ? "Refreshing submissions." : ""}
      </div>
    </main>
  );
}

export default CertificateWorkflow;
