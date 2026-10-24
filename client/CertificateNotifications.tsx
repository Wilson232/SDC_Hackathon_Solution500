import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import "./certificates.css";
import "./certificate-notifications.css";

type CertificateNotification = {
  id: string | number;
  planId: string | number;
  careerTitle: string;
  decision: "approved" | "rejected";
  note: string | null;
  createdAt: string;
  readAt: string | null;
};

type ApiError = { error?: string };

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
      // Keep the readable fallback if the server did not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CertificateNotifications({
  onOpenPlan,
}: {
  onOpenPlan: (planId: string) => void;
}) {
  const [notifications, setNotifications] = useState<CertificateNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [markErrors, setMarkErrors] = useState<Record<string, string>>({});
  const activeRef = useRef(false);
  const pollingRef = useRef(false);
  const markedReadRef = useRef(new Set<string>());

  const loadNotifications = useCallback(async () => {
    if (!activeRef.current || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const result = await request<CertificateNotification[]>("/api/notifications");
      if (!activeRef.current) return;
      if (!Array.isArray(result)) throw new Error("Notifications could not be loaded. Please try again.");
      setNotifications(
        result.filter((item) => !item.readAt && !markedReadRef.current.has(String(item.id))),
      );
      setFetchError("");
    } catch (error) {
      if (!activeRef.current) return;
      setFetchError(error instanceof Error ? error.message : "Notifications could not be loaded.");
    } finally {
      pollingRef.current = false;
      if (activeRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30_000);
    const onFocus = () => void loadNotifications();
    window.addEventListener("focus", onFocus);
    return () => {
      activeRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadNotifications]);

  const markAsRead = async (notification: CertificateNotification) => {
    const id = String(notification.id);
    if (busyIds.has(id)) return;
    setBusyIds((previous) => new Set(previous).add(id));
    try {
      await request<{ id: string | number; readAt: string }>(
        `/api/notifications/${encodeURIComponent(id)}/read`,
        { method: "PATCH" },
      );
      if (!activeRef.current) return;
      markedReadRef.current.add(id);
      setNotifications((previous) => previous.filter((item) => String(item.id) !== id));
      setMarkErrors((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    } catch (error) {
      if (!activeRef.current) return;
      setMarkErrors((previous) => ({
        ...previous,
        [id]: error instanceof Error ? error.message : "This notification could not be marked as read.",
      }));
    } finally {
      if (activeRef.current) {
        setBusyIds((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const unreadCount = notifications.length;

  return (
    <section className="cert-notifications" aria-labelledby="cert-notifications-title">
      <header className="cert-notifications__header">
        <div>
          <span className="cert-kicker">Certificate review</span>
          <h2 id="cert-notifications-title">Your pathway updates</h2>
          <p>Human-reviewed decisions about your completion evidence.</p>
        </div>
        <span className="cert-notifications__count" aria-label={`${unreadCount} unread notifications`}>
          {unreadCount} unread
        </span>
      </header>

      {fetchError && (
        <div className="cert-alert cert-alert--error cert-notifications__error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{fetchError}</span>
          <button className="cert-button cert-button--secondary" type="button" onClick={() => void loadNotifications()}>
            <RefreshCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="cert-notifications__loading" role="status" aria-label="Loading certificate notifications">
          <div className="cert-skeleton cert-skeleton--title" />
          <div className="cert-skeleton" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="cert-notifications__empty" role="status">
          <span className="cert-notifications__empty-icon"><CheckCircle2 size={21} aria-hidden="true" /></span>
          <div>
            <strong>You’re all caught up.</strong>
            <p>New certificate review decisions will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="cert-notifications__list" aria-live="polite">
          {notifications.map((notification) => {
            const id = String(notification.id);
            const approved = notification.decision === "approved";
            const planId = String(notification.planId);
            const href = `?certificatePlan=${encodeURIComponent(planId)}`;
            return (
              <article
                className={`cert-notification ${approved ? "cert-notification--approved" : "cert-notification--rejected"}`}
                key={id}
              >
                <span className="cert-notification__mark" aria-hidden="true">
                  {approved ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </span>
                <div className="cert-notification__body">
                  <div className="cert-notification__topline">
                    <span className="cert-notification__decision">
                      {approved ? "Evidence approved" : "Changes requested"}
                    </span>
                    {notification.createdAt && (
                      <time dateTime={notification.createdAt}>
                        <Clock3 size={13} aria-hidden="true" />
                        {formatDate(notification.createdAt)}
                      </time>
                    )}
                  </div>
                  <a
                    className="cert-notification__plan-link"
                    href={href}
                    onClick={(event) => {
                      if (
                        event.button === 0 &&
                        !event.metaKey &&
                        !event.ctrlKey &&
                        !event.shiftKey &&
                        !event.altKey
                      ) {
                        event.preventDefault();
                        onOpenPlan(planId);
                      }
                    }}
                  >
                    {notification.careerTitle}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                  {!approved && notification.note && (
                    <p className="cert-notification__note">{notification.note}</p>
                  )}
                  {markErrors[id] && <p className="cert-notification__mark-error" role="alert">{markErrors[id]}</p>}
                  <button
                    className="cert-notification__read-button"
                    type="button"
                    onClick={() => void markAsRead(notification)}
                    disabled={busyIds.has(id)}
                  >
                    {busyIds.has(id) ? (
                      <><LoaderCircle size={15} className="cert-spinning" aria-hidden="true" /> Marking as read…</>
                    ) : (
                      "Mark as read"
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
