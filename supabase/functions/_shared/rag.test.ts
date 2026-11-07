import { describe, expect, it } from 'vitest';
import {
  INSUFFICIENT,
  buildAnswerMessages,
  chunkPages,
  cleanCitationMarkers,
  detectLanguage,
  expandDialect,
  findCourseNumbers,
  isHeading,
  isInsufficient,
  looksVisuallyReversed,
  normalizeArabic,
  normalizeForSearch,
  parseCitations,
  parseRewrite,
  reverseVisualLine,
} from './rag';

describe('Arabic normalization', () => {
  it('removes diacritics and tatweel and unifies letter variants', () => {
    expect(normalizeArabic('المُتَطَلَّبَات')).toBe('المتطلبات');
    expect(normalizeArabic('جـــامعة')).toBe('جامعه');
    expect(normalizeArabic('أإآ')).toBe('ااا');
    expect(normalizeArabic('مستوى')).toBe('مستوي');
  });

  it('converts Arabic-Indic digits', () => {
    expect(normalizeArabic('المادة ١٢')).toBe('الماده 12');
  });

  it('produces the same search form for query and content variants', () => {
    expect(normalizeForSearch('المتطلبات السابقة')).toBe(normalizeForSearch('متطلبات سابقه'));
    expect(normalizeForSearch('والانسحاب')).toBe(normalizeForSearch('انسحاب'));
  });

  it('maps Palestinian colloquial words to MSA hints', () => {
    expect(expandDialect('شو المواد اللي لازم انزلها')).toContain('ما');
    expect(expandDialect('قديش ساعة بقدر اسجل')).toBe('كم ساعه استطيع اسجل');
  });

  it('detects the dominant language', () => {
    expect(detectLanguage('شو متطلبات التخرج؟')).toBe('ar');
    expect(detectLanguage('What are the graduation requirements?')).toBe('en');
  });
});

describe('chunking', () => {
  const page1 = ['المادة (1)', 'تسري أحكام هذه التعليمات على جميع طلبة البكالوريوس في الجامعة.', '', 'المادة (2)', 'الحد الأعلى للعبء الدراسي في الفصل العادي يحدد وفق تعليمات الجامعة المعتمدة.'].join('\n');
  const page2 = 'يتابع النص من الصفحة السابقة ويحتوي على تفاصيل إضافية حول التسجيل والانسحاب من المساقات.';

  it('keeps every chunk on a single page with its number', () => {
    const chunks = chunkPages([page1, page2], { targetSize: 120, overlap: 20 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.page_number === 1 || c.page_number === 2)).toBe(true);
    expect(chunks.at(-1)?.page_number).toBe(2);
    expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i));
  });

  it('carries the latest heading as section title, across pages', () => {
    const chunks = chunkPages([page1, page2], { targetSize: 120, overlap: 0 });
    expect(chunks[0].section_title).toBe('المادة (1)');
    expect(chunks.find((c) => c.content.includes('العادي'))?.section_title).toBe('المادة (2)');
    expect(chunks.at(-1)?.section_title).toBe('المادة (2)');
  });

  it('respects the target size for long text', () => {
    const long = Array.from({ length: 200 }, (_, i) => `كلمة${i}`).join(' ');
    const chunks = chunkPages([long], { targetSize: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.content.length <= 300 + 60)).toBe(true);
  });

  it('skips empty pages', () => {
    expect(chunkPages(['', '   '])).toEqual([]);
  });

  it('recognizes headings in Arabic and English', () => {
    expect(isHeading('المادة (12)')).toBe(true);
    expect(isHeading('Article 5')).toBe(true);
    expect(isHeading('هذا سطر عادي من النص.')).toBe(false);
  });

  it('repairs visually reversed Arabic extraction', () => {
    const reversed = Array.from({ length: 25 }, () => reverseVisualLine('الفصل الدراسي')).join(' ');
    expect(looksVisuallyReversed(reversed)).toBe(true);
    expect(reverseVisualLine(reverseVisualLine('المادة 12 من النظام'))).toBe('المادة 12 من النظام');
    expect(looksVisuallyReversed(Array.from({ length: 25 }, () => 'الفصل الدراسي').join(' '))).toBe(false);
  });
});

describe('citations and refusals', () => {
  it('extracts only valid evidence indices in order', () => {
    expect(parseCitations('A [2] then [1][2] and [7] and [١]', 3)).toEqual([2, 1]);
    expect(parseCitations('list [1, 3]', 3)).toEqual([1, 3]);
    expect(parseCitations('no markers here', 3)).toEqual([]);
  });

  it('removes markers that point to non-existent evidence', () => {
    expect(cleanCitationMarkers('Fact [1]. Other [9]. Both [1, 2].', [1, 2])).toBe('Fact [1]. Other. Both [1][2].');
  });

  it('flags insufficient answers', () => {
    expect(isInsufficient(INSUFFICIENT)).toBe(true);
    expect(isInsufficient('')).toBe(true);
    expect(isInsufficient('The limit is 18 credit hours [1].')).toBe(false);
  });

  it('builds a strictly grounded prompt with numbered evidence', () => {
    const msgs = buildAnswerMessages({
      question: 'ما الحد الأعلى للساعات؟',
      language: 'ar',
      history: [],
      evidence: [{ kind: 'document', title: 'تعليمات منح درجة البكالوريوس', version_label: '2024', page_number: 7, section_title: 'المادة (9)', content: 'نص الدليل' }],
    });
    expect(msgs[0].content).toContain(INSUFFICIENT);
    expect(msgs[0].content).toContain('ONLY');
    expect(msgs[1].content).toContain('[1] Document: تعليمات منح درجة البكالوريوس | Version: 2024 | Page: 7 | Section: المادة (9)');
  });

  it('parses query rewrites and falls back safely', () => {
    expect(parseRewrite('{"intent":"smalltalk","standalone_question":"hi","search_query_ar":"","search_query_en":""}', 'x').intent).toBe('smalltalk');
    const fb = parseRewrite('not json', 'شو شروط الانسحاب');
    expect(fb.intent).toBe('question');
    expect(fb.standalone_question).toBe('شو شروط الانسحاب');
    expect(fb.search_query_ar).toContain('ما');
  });

  it('finds course number candidates', () => {
    const c = findCourseNumbers('شو متطلبات مساق CS 201 و ٠٣٠١١٠١؟');
    expect(c).toContain('CS201');
    expect(c).toContain('CS-201');
    expect(c).toContain('0301101');
  });
});
