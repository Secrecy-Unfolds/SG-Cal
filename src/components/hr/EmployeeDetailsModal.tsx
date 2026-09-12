"use client";

import { useState } from "react";
import type { EmployeeDetails } from "@/lib/hr";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function EmployeeDetailsModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: EmployeeDetails;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [position, setPosition] = useState(employee.position);
  const [department, setDepartment] = useState(employee.department);
  const [joinDate, setJoinDate] = useState(employee.join_date ?? "");
  const [salary, setSalary] = useState(employee.salary ?? "");
  const [salaryCurrency, setSalaryCurrency] = useState(employee.salary_currency);
  const [emergencyContactName, setEmergencyContactName] = useState(employee.emergency_contact_name);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(employee.emergency_contact_phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/hr/employees/${employee.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position,
          department,
          joinDate: joinDate || null,
          salary: salary === "" ? null : Number(salary),
          salaryCurrency,
          emergencyContactName,
          emergencyContactPhone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">{employee.username}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Position</label>
            <input className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Department</label>
            <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Join date</label>
          <input
            type="date"
            className={`${inputClass} dark:[color-scheme:dark]`}
            value={joinDate}
            onChange={(e) => setJoinDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Salary</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Currency</label>
            <input className={inputClass} value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Emergency contact name</label>
            <input
              className={inputClass}
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Emergency contact phone</label>
            <input
              type="tel"
              className={inputClass}
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-skew btn-glow px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
