import { afterEach, expect, it } from 'vitest';
import { getLocale, LANGUAGE_KEY, setLocale, t } from '../src/i18n';

afterEach(() => { localStorage.removeItem(LANGUAGE_KEY); document.documentElement.lang = 'zh-CN' });

it('语言偏好持久保存并只翻译显式界面文字', () => {
  expect(getLocale()).toBe('zh-CN');
  expect(t('艺人')).toBe('艺人');
  setLocale('en');
  expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  expect(t('艺人')).toBe('Performers');
  expect(t('SNOS-449')).toBe('SNOS-449');
  expect(t('ユーザーのタイトル')).toBe('ユーザーのタイトル');
  setLocale('zh-CN');
  expect(t('艺人')).toBe('艺人');
});

it('未知保存值使用中文', () => {
  localStorage.setItem(LANGUAGE_KEY, 'unsupported');
  expect(getLocale()).toBe('zh-CN');
});
