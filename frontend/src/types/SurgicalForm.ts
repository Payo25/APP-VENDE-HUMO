export interface SurgicalForm {
  id: string;
  patientName: string;
  dob: string; // ISO date string
  insuranceCompany: string;
  healthCenterName: string;
  date: string; // ISO date string for surgery date
  timeIn: string;
  timeOut: string;
  doctorName: string;
  procedure: string;
  caseType: string;
  assistantType?: string;
  status: string;
  createdBy: string;
  createdByUserId?: string;
  createdByFullName?: string;
  createdByEmail?: string;
  createdAt?: string;
  lastModified?: string;
  surgeryFormFileUrl?: string;
}
