"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Star } from "lucide-react";
import { reviewApi, PublicReview } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import { ReportDialog } from "@/components/reports/ReportDialog";

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5 text-gold" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= value ? "fill-current" : "opacity-25"}`} />
      ))}
    </span>
  );
}

export function PropertyReviews({ propertyId, canReview }: { propertyId: string; canReview: boolean }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [flagging, setFlagging] = useState<PublicReview | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setReviews((await reviewApi.listForProperty(propertyId)).reviews);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load reviews.");
      setReviews([]);
    }
  }, [propertyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches data on mount; the loader sets its loading state before awaiting
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setFormError("Choose a star rating first.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await reviewApi.create({ propertyId, rating, body: body.trim() || undefined });
      setSubmitted(true);
      setRating(0);
      setBody("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not post your review.");
    } finally {
      setSubmitting(false);
    }
  }

  const average =
    reviews && reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <section id="reviews" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">
          Reviews{reviews && reviews.length > 0 ? ` (${reviews.length})` : ""}
        </h2>
        {average !== null && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Stars value={Math.round(average)} />
            {average.toFixed(1)} average
          </div>
        )}
      </div>

      {loadError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}{" "}
          <button onClick={load} className="font-medium underline">
            Try again
          </button>
        </p>
      )}

      {reviews === null ? (
        <div className="skeleton h-20 rounded-xl" />
      ) : reviews.length === 0 ? (
        !loadError && <p className="text-sm text-gray-500">No reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={r.rating} />
                <span className="text-xs text-gray-500">
                  {r.author_name} · {formatDate(r.created_at)}
                </span>
              </div>
              {/* Plain text only: never injected as HTML */}
              {r.body && <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{r.body}</p>}
              {user &&
                (flagged.has(r.id) ? (
                  <p className="mt-2 text-xs text-gray-500">Reported. Thanks.</p>
                ) : (
                  <button
                    onClick={() => setFlagging(r)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                  >
                    <Flag className="h-3 w-3" /> Report review
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {canReview &&
        (submitted ? (
          <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Thanks, your review is live.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 p-4">
            <p className="font-medium text-ink">Review this property</p>
            <div role="radiogroup" aria-label="Rating" className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setRating(n)}
                  className="text-gold"
                >
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-current" : "opacity-30"}`} />
                </button>
              ))}
            </div>
            <textarea
              className="field-input"
              rows={3}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What was it like to live here? (optional)"
              aria-label="Review text"
            />
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post review"}
            </button>
          </form>
        ))}

      {flagging && (
        <ReportDialog
          open
          kind="REVIEW_FLAG"
          targetType="REVIEW"
          targetId={flagging.id}
          title="Report this review"
          description="Tell us what's wrong with it, for example abusive, fake or off-topic."
          defaultSubject="Inappropriate review"
          onSent={() => setFlagged((s) => new Set(s).add(flagging.id))}
          onClose={() => setFlagging(null)}
        />
      )}
    </section>
  );
}