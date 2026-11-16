// Core data model. Kept plain so it maps 1:1 to database tables in the real build.

export type Role = "owner" | "manager" | "lead" | "technician";

export interface Person {
  id: string;
  name: string;
  role: Role;
  teamId?: string;
  phone?: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  leadId?: string;
}

export const STAGES = [
  "Documentation",
  "MOI approval",
  "Infrastructure",
  "Installation",
  "Engineering",
  "Inspection",
  "Handover",
  "Maintenance",
] as const;
export type Stage = (typeof STAGES)[number];

export interface Site {
  id: string;
  name: string;
  client: string;
  address?: string;
  lat: number;
  lng: number;
  /** Geofence radius in metres */
  radius: number;
  stage: Stage;
  color: string;
  createdAt: string;
}

/** Who can see an assignment */
export type Visibility = "assigned" | "team" | "everyone";
/** Who can change an assignment */
export type Editors = "managers" | "managers+lead";

export type Kind = "task" | "maintenance";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface Assignment {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  siteId: string;
  teamId?: string;
  assigneeIds: string[];
  start: string; // ISO
  end: string; // ISO
  visibility: Visibility;
  editors: Editors;
  priority: Priority;
  /** Technician must send a short report when done */
  reportRequired: boolean;
  createdBy: string;
  createdAt: string;
  manualStatus?: "done" | "stuck" | "cancelled";
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** One record per person per assignment */
export interface Attendance {
  id: string;
  assignmentId: string;
  personId: string;
  checkInAt?: string;
  checkInLoc?: GeoPoint;
  checkInDist?: number;
  checkOutAt?: string;
  checkOutLoc?: GeoPoint;
  checkOutDist?: number;
}

export type Outcome = "fixed" | "partly" | "follow-up";

export interface Report {
  id: string;
  assignmentId: string;
  personId: string;
  at: string;
  text: string;
  outcome: Outcome;
}

export interface Ping extends GeoPoint {
  personId: string;
  at: string;
}

export interface Attempt {
  id: string;
  personId: string;
  assignmentId: string;
  at: string;
  lat: number;
  lng: number;
  dist: number;
  kind: "checkin-rejected";
}

export interface Settings {
  /** Minutes after start before "late" */
  lateGraceMin: number;
  /** Minutes before end that counts as leaving early */
  earlyLeaveMin: number;
  /** Minutes after check-out still inside the site before alerting */
  stillOnSiteMin: number;
  /** Minutes after check-out (or end) to send the report */
  reportDueMin: number;
}

export type AlertType =
  | "late"
  | "checkin-rejected"
  | "early-checkout"
  | "report-late"
  | "overdue"
  | "still-on-site";

export interface AlertItem {
  id: string;
  type: AlertType;
  severity: "high" | "medium" | "low";
  assignmentId: string;
  personId: string;
  at: string;
  title: string;
  detail: string;
  /** true while the problem is still happening right now */
  live: boolean;
}
