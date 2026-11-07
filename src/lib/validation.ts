import type { Dict } from '../i18n/ar';

export type Errors<K extends string> = Partial<Record<K, string>>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const COURSE_NUMBER_RE = /^[A-Za-z0-9-]{2,20}$/;

export function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z\u0600-\u06FF]/.test(pw) && /\d/.test(pw);
}

type V = Dict['validation'];

export function validateContact(values: { name: string; email: string; subject: string; message: string }, v: V) {
  const e: Errors<keyof typeof values> = {};
  if (!values.name.trim()) e.name = v.required;
  else if (values.name.trim().length < 2) e.name = v.minLength(2);
  else if (values.name.length > 120) e.name = v.maxLength(120);
  if (!values.email.trim()) e.email = v.required;
  else if (!EMAIL_RE.test(values.email.trim())) e.email = v.email;
  if (!values.subject.trim()) e.subject = v.required;
  else if (values.subject.trim().length < 3) e.subject = v.minLength(3);
  else if (values.subject.length > 200) e.subject = v.maxLength(200);
  if (!values.message.trim()) e.message = v.required;
  else if (values.message.trim().length < 10) e.message = v.minLength(10);
  else if (values.message.length > 5000) e.message = v.maxLength(5000);
  return e;
}

export interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  universityId: string;
  faculty: string;
  major: string;
}

export function validateRegister(values: RegisterValues, v: V) {
  const e: Errors<keyof RegisterValues> = {};
  if (!values.fullName.trim()) e.fullName = v.required;
  else if (values.fullName.trim().length < 3) e.fullName = v.minLength(3);
  else if (values.fullName.length > 120) e.fullName = v.maxLength(120);
  if (!values.email.trim()) e.email = v.required;
  else if (!EMAIL_RE.test(values.email.trim())) e.email = v.email;
  if (!values.password) e.password = v.required;
  else if (!isStrongPassword(values.password)) e.password = v.passwordWeak;
  if (!values.confirmPassword) e.confirmPassword = v.required;
  else if (values.confirmPassword !== values.password) e.confirmPassword = v.passwordMismatch;
  if (values.universityId.trim() && !/^\d{4,12}$/.test(values.universityId.trim())) e.universityId = v.universityId;
  if (!values.faculty.trim()) e.faculty = v.required;
  if (!values.major.trim()) e.major = v.required;
  return e;
}

export function validateLogin(values: { email: string; password: string }, v: V) {
  const e: Errors<'email' | 'password'> = {};
  if (!values.email.trim()) e.email = v.required;
  else if (!EMAIL_RE.test(values.email.trim())) e.email = v.email;
  if (!values.password) e.password = v.required;
  return e;
}

export const hasErrors = (e: object) => Object.values(e).some(Boolean);
