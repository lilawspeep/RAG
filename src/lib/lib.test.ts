import { describe, expect, it } from 'vitest';
import { ar } from '../i18n/ar';
import { en } from '../i18n/en';
import { parseCsv, toCsv } from './csv';
import { COURSE_NUMBER_RE, hasErrors, isStrongPassword, validateContact, validateLogin, validateRegister } from './validation';

const v = ar.validation;

describe('validation', () => {
  it('requires strong passwords', () => {
    expect(isStrongPassword('short1')).toBe(false);
    expect(isStrongPassword('longpassword')).toBe(false);
    expect(isStrongPassword('goodpass1')).toBe(true);
  });

  it('validates the contact form', () => {
    expect(hasErrors(validateContact({ name: '', email: 'bad', subject: 'a', message: 'short' }, v))).toBe(true);
    expect(validateContact({ name: 'ليلى', email: 'laila@example.com', subject: 'سؤال', message: 'رسالة كافية الطول' }, v)).toEqual({});
  });

  it('validates registration, including the optional university id', () => {
    const base = { fullName: 'طالب تجريبي', email: 's@example.com', password: 'abcdefg1', confirmPassword: 'abcdefg1', universityId: '', faculty: 'x', major: 'y' };
    expect(validateRegister(base, v)).toEqual({});
    expect(validateRegister({ ...base, confirmPassword: 'other' }, v).confirmPassword).toBe(v.passwordMismatch);
    expect(validateRegister({ ...base, universityId: '12ab' }, v).universityId).toBe(v.universityId);
  });

  it('validates login', () => {
    expect(hasErrors(validateLogin({ email: '', password: '' }, v))).toBe(true);
    expect(validateLogin({ email: 'a@b.co', password: 'x' }, v)).toEqual({});
  });

  it('accepts canonical course numbers only', () => {
    expect(COURSE_NUMBER_RE.test('0301101')).toBe(true);
    expect(COURSE_NUMBER_RE.test('CS-201')).toBe(true);
    expect(COURSE_NUMBER_RE.test('CS 201')).toBe(false);
    expect(COURSE_NUMBER_RE.test("1'; drop")).toBe(false);
  });
});

describe('csv', () => {
  it('round-trips quoted Arabic values with commas, quotes and newlines', () => {
    const rows = [{ course_number: '0301101', name_ar: 'مقدمة، "برمجة"', description_ar: 'سطر\nثانٍ' }];
    const parsed = parseCsv(toCsv(rows, ['course_number', 'name_ar', 'description_ar']));
    expect(parsed).toEqual(rows);
  });

  it('handles CRLF and a UTF-8 BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });
});

describe('i18n', () => {
  const shape = (o: unknown): unknown =>
    Array.isArray(o) ? `array` : typeof o === 'object' && o ? Object.fromEntries(Object.entries(o).map(([k, val]) => [k, shape(val)])) : typeof o;

  it('Arabic and English dictionaries have identical keys', () => {
    expect(shape(en)).toEqual(shape(ar));
  });

  it('keeps the unofficial-project disclaimer in both languages', () => {
    expect(en.footer.unofficialEn).toBe('Unofficial student-built academic project.');
    expect(ar.meta.unofficial).toContain('غير رسمي');
  });
});
