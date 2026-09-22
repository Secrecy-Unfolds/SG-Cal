"use client";

import { useEffect, useState } from "react";
import CurrencySelect from "@/components/CurrencySelect";
import EmployeeDocumentsPanel from "@/components/hr/EmployeeDocumentsPanel";
import type { EmployeeDetails } from "@/lib/hr";
import { isStructureControlled, type DepartmentRow, type JobTitleRow } from "@/lib/orgDisplay";
import { isExpatCountry } from "@/lib/hrDisplay";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";
const dateClass = `${inputClass} dark:[color-scheme:dark]`;
const optionClass = "bg-white text-ink dark:bg-neutral-900 dark:text-neutral-100";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40 pt-1">
      {children}
    </h3>
  );
}

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
  const [departmentId, setDepartmentId] = useState<number | null>(employee.department_id);
  const [jobTitleId, setJobTitleId] = useState<number | null>(employee.job_title_id);
  const [reportsToId, setReportsToId] = useState<number | null>(employee.reports_to_id);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [titles, setTitles] = useState<JobTitleRow[]>([]);
  const [chiefOfficers, setChiefOfficers] = useState<{ id: number; username: string }[]>([]);
  const [joinDate, setJoinDate] = useState(employee.join_date ?? "");
  const [salary, setSalary] = useState(employee.salary ?? "");
  const [salaryCurrency, setSalaryCurrency] = useState(employee.salary_currency);
  const [emergencyContactName, setEmergencyContactName] = useState(employee.emergency_contact_name);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(employee.emergency_contact_phone);
  const [annualLeaveDays, setAnnualLeaveDays] = useState(employee.annual_leave_days ?? "");

  // Richer details (0.2.17). Civil ID/Passport/Visa/DOB/Religion/Father's
  // name are the "sensitive" fields (lib/hrDisplay.ts's
  // SENSITIVE_EMPLOYEE_FIELDS) — Admin-level always sees/edits everything
  // here, unaffected by that read-side hierarchy rule.
  const [civilId, setCivilId] = useState(employee.civil_id);
  const [civilIdExpiry, setCivilIdExpiry] = useState(employee.civil_id_expiry ?? "");
  const [passportNumber, setPassportNumber] = useState(employee.passport_number);
  const [passportExpiry, setPassportExpiry] = useState(employee.passport_expiry ?? "");
  const [country, setCountry] = useState(employee.country);
  const [visaExpiry, setVisaExpiry] = useState(employee.visa_expiry ?? "");
  const [contractExpiry, setContractExpiry] = useState(employee.contract_expiry ?? "");
  const [fatherName, setFatherName] = useState(employee.father_name);
  const [religion, setReligion] = useState(employee.religion);
  const [dateOfBirth, setDateOfBirth] = useState(employee.date_of_birth ?? "");
  const [gender, setGender] = useState(employee.gender);
  const [educationLevel, setEducationLevel] = useState(employee.education_level);
  const [degreeField, setDegreeField] = useState(employee.degree_field);
  const [graduationDate, setGraduationDate] = useState(employee.graduation_date ?? "");
  const [yearsExperience, setYearsExperience] = useState(employee.years_experience ?? "");
  const [recommendedBy, setRecommendedBy] = useState(employee.recommended_by);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/org/departments").then((r) => (r.ok ? r.json() : { departments: [] })),
      fetch("/api/org/job-titles").then((r) => (r.ok ? r.json() : { titles: [] })),
      fetch("/api/org/chief-officers").then((r) => (r.ok ? r.json() : { chiefOfficers: [] })),
    ])
      .then(([d, t, c]) => {
        setDepartments(d.departments ?? []);
        setTitles(t.titles ?? []);
        setChiefOfficers(c.chiefOfficers ?? []);
      })
      .catch(() => {});
  }, []);

  // A Department's Manager / a Director has their Department and title driven
  // by that role (lib/org.ts) — shown locked here. Otherwise the title list
  // leaves out Manager / Director / Project Head / Team Lead, which come only
  // from the structure.
  const managedDepartment = employee.managed_department_id
    ? departments.find((d) => d.id === employee.managed_department_id)
    : null;
  const isManager = employee.managed_department_id !== null;
  const isDirector = !isManager && employee.directed_department_count > 0;
  const isProjectHead = !isManager && !isDirector && employee.headed_project_count > 0;
  const isTeamLead = !isManager && !isDirector && !isProjectHead && employee.leads_team;
  const titleLocked = isManager || isDirector || isProjectHead || isTeamLead;
  const selectableTitles = titles.filter((t) => !isStructureControlled(t.structural_key) || t.id === employee.job_title_id);
  const currentTitleKey = titles.find((t) => t.id === jobTitleId)?.structural_key ?? null;
  const showReportsTo = isDirector || currentTitleKey === "director";
  const showVisa = isExpatCountry(country);

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
          departmentId: isManager ? employee.managed_department_id : departmentId,
          jobTitleId: titleLocked ? employee.job_title_id : jobTitleId,
          reportsToId: showReportsTo ? reportsToId : null,
          joinDate: joinDate || null,
          salary: salary === "" ? null : Number(salary),
          salaryCurrency,
          emergencyContactName,
          emergencyContactPhone,
          annualLeaveDays: annualLeaveDays === "" ? null : Number(annualLeaveDays),
          civilId,
          civilIdExpiry: civilIdExpiry || null,
          passportNumber,
          passportExpiry: passportExpiry || null,
          visaExpiry: showVisa ? visaExpiry || null : null,
          contractExpiry: contractExpiry || null,
          fatherName,
          religion,
          country,
          dateOfBirth: dateOfBirth || null,
          gender,
          educationLevel,
          degreeField,
          graduationDate: graduationDate || null,
          yearsExperience: yearsExperience === "" ? null : Number(yearsExperience),
          recommendedBy,
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
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Position</label>
            <input className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Department</label>
            <select
              className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
              value={(isManager ? employee.managed_department_id : departmentId) ?? ""}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
              disabled={isManager}
            >
              <option className={optionClass} value="">
                No department
              </option>
              {departments.map((d) => (
                <option key={d.id} className={optionClass} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Job title</label>
          <select
            className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
            value={jobTitleId ?? ""}
            onChange={(e) => setJobTitleId(e.target.value ? Number(e.target.value) : null)}
            disabled={titleLocked}
          >
            <option className={optionClass} value="">
              No title
            </option>
            {selectableTitles.map((t) => (
              <option key={t.id} className={optionClass} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {titleLocked ? (
            <p className="text-xs text-black/40 dark:text-white/40">
              {isManager
                ? `Set automatically: they are the Manager of ${managedDepartment?.name ?? "their department"}. Change it from the department.`
                : isDirector
                ? "Set automatically: they are a department's Director. Change it from the department."
                : isProjectHead
                ? "Set automatically: they are a Project Head. Change it from the project."
                : "Set automatically: they are a Team Lead. Change it from the team."}
            </p>
          ) : (
            <p className="text-xs text-black/40 dark:text-white/40">
              Manager, Director, Project Head and Team Lead are set from the department / project / team itself.
            </p>
          )}
        </div>

        {showReportsTo && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Reports to (Chief Officer)</label>
            <select
              className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
              value={reportsToId ?? ""}
              onChange={(e) => setReportsToId(e.target.value ? Number(e.target.value) : null)}
            >
              <option className={optionClass} value="">
                Not set
              </option>
              {chiefOfficers.map((c) => (
                <option key={c.id} className={optionClass} value={c.id}>
                  {c.username}
                </option>
              ))}
            </select>
            {chiefOfficers.length === 0 && (
              <p className="text-xs text-black/40 dark:text-white/40">
                No one has the Chief Officer title yet — give it to someone first.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Join date</label>
          <input type="date" className={dateClass} value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <CurrencySelect className={inputClass} value={salaryCurrency} onChange={setSalaryCurrency} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="space-y-1">
          <label className="text-sm font-medium">Annual leave allowance (days)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            max="366"
            className={inputClass}
            value={annualLeaveDays}
            onChange={(e) => setAnnualLeaveDays(e.target.value)}
            placeholder="Leave blank if not set"
          />
          <p className="text-xs text-black/40 dark:text-white/40">
            Per calendar year. Days count Sun&ndash;Thu, excluding public holidays.
          </p>
        </div>

        <div className="border-t border-black/5 dark:border-white/10 pt-3 space-y-3">
          <SectionLabel>Personal &amp; compliance</SectionLabel>
          <p className="text-xs text-black/40 dark:text-white/40 -mt-2">
            Civil ID, Passport, Visa, Date of birth, Religion and Father&rsquo;s name are only shown to Admin-level
            accounts and to whoever this person reports up to — not to a peer or anyone else.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Civil ID</label>
              <input className={inputClass} value={civilId} onChange={(e) => setCivilId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Civil ID expiry</label>
              <input type="date" className={dateClass} value={civilIdExpiry} onChange={(e) => setCivilIdExpiry(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Passport number</label>
              <input className={inputClass} value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Passport expiry</label>
              <input
                type="date"
                className={dateClass}
                value={passportExpiry}
                onChange={(e) => setPassportExpiry(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Country</label>
              <input
                className={inputClass}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Oman"
              />
              <p className="text-xs text-black/40 dark:text-white/40">Anything other than Oman shows the Visa field.</p>
            </div>
            {showVisa && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Visa expiry</label>
                <input type="date" className={dateClass} value={visaExpiry} onChange={(e) => setVisaExpiry(e.target.value)} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date of birth</label>
              <input
                type="date"
                className={dateClass}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Gender</label>
              <input className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Father&rsquo;s name</label>
              <input className={inputClass} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Religion</label>
              <input className={inputClass} value={religion} onChange={(e) => setReligion(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Contract expiry</label>
            <input
              type="date"
              className={dateClass}
              value={contractExpiry}
              onChange={(e) => setContractExpiry(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-black/5 dark:border-white/10 pt-3 space-y-3">
          <SectionLabel>Education &amp; background</SectionLabel>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Education level</label>
              <input
                className={inputClass}
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value)}
                placeholder="e.g. Bachelor's"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Degree / field of study</label>
              <input className={inputClass} value={degreeField} onChange={(e) => setDegreeField(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Graduation date</label>
              <input
                type="date"
                className={dateClass}
                value={graduationDate}
                onChange={(e) => setGraduationDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Years of experience</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="80"
                className={inputClass}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Recommended by (optional)</label>
            <input className={inputClass} value={recommendedBy} onChange={(e) => setRecommendedBy(e.target.value)} />
          </div>
        </div>

        <div className="border-t border-black/5 dark:border-white/10 pt-3">
          <SectionLabel>Documents</SectionLabel>
          <EmployeeDocumentsPanel userId={employee.user_id} canManage />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={onClose}
              className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </span>
          <span className="btn-glow inline-block">
            <button
              type="submit"
              disabled={saving}
              className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}
