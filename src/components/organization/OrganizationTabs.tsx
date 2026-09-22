"use client";

import { useState } from "react";
import DepartmentsClient from "@/components/organization/DepartmentsClient";
import JobTitlesClient from "@/components/organization/JobTitlesClient";
import OrgChartClient from "@/components/organization/OrgChartClient";
import TeamsManager from "@/components/projects/TeamsManager";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";
import type { DepartmentRow, JobTitleRow, OrgChartNode } from "@/lib/orgDisplay";
import type { TeamRow } from "@/lib/projectDisplay";

type Tab = "departments" | "titles" | "teams" | "chart";

export default function OrganizationTabs({
  departments,
  titles,
  users,
  teams,
  projects,
  roots,
  unplaced,
}: {
  departments: DepartmentRow[];
  titles: JobTitleRow[];
  users: { id: number; username: string }[];
  teams: TeamRow[];
  projects: { id: number; name: string }[];
  roots: OrgChartNode[];
  unplaced: OrgChartNode[];
}) {
  const [tab, setTab] = useState<Tab>("departments");

  const tabs: { key: Tab; label: string }[] = [
    { key: "departments", label: "Departments" },
    { key: "titles", label: "Job Titles" },
    { key: "teams", label: "Teams" },
    { key: "chart", label: "Org Chart" },
  ];

  return (
    <div>
      <PageHeader label="ORGANIZATION" title="Organization" />
      <FolderTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === "departments" && <DepartmentsClient departments={departments} users={users} />}
      {tab === "titles" && <JobTitlesClient titles={titles} />}
      {tab === "teams" && <TeamsManager teams={teams} projects={projects} users={users} />}
      {tab === "chart" && <OrgChartClient roots={roots} unplaced={unplaced} />}
    </div>
  );
}
