import type { AxiosError } from "axios";
import { FormEvent, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import api from "../lib/api";
import { isAdmin, useAuthStore } from "../store/auth";

const MAX_FEEDBACK_LENGTH = 250;

const DonorCornerPage = () => {
  const user = useAuthStore((state) => state.user);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const remainingChars = useMemo(
    () => MAX_FEEDBACK_LENGTH - feedback.length,
    [feedback.length],
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isAdmin(user.role)) {
    return <Navigate to="/admin/master" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFeedback = feedback.trim();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!trimmedFeedback) {
      setErrorMessage("Please enter your feedback.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("auth/donor-feedback/", { feedback: trimmedFeedback });
      setFeedback("");
      setSuccessMessage("Your feedback has been submitted successfully.");
    } catch (error) {
      const detail = (error as AxiosError<{ detail?: string }>).response?.data?.detail;
      setErrorMessage(detail || "Unable to submit feedback right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-900">Donor Corner</h3>
        <p className="mt-2 text-sm text-slate-600">
          Share your feedback, suggestions, complaints, or any other comments.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={MAX_FEEDBACK_LENGTH}
            rows={6}
            placeholder="Type your feedback here..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {remainingChars} / {MAX_FEEDBACK_LENGTH} characters remaining
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>

        {successMessage && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default DonorCornerPage;
