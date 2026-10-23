import { getLocale, setLocale, type Locale } from '../../i18n';

/** 语言属于当前浏览器；重载后路由与遗留壳使用同一份词表。 */
export function LanguageSetting() {
  return <div data-setting-row="">
    <label htmlFor="peach-language"><b>Language / 语言</b></label>
    <select id="peach-language" value={getLocale()} onChange={(event) => {
      setLocale(event.target.value as Locale);
      location.reload();
    }}>
      <option value="zh-CN">简体中文</option>
      <option value="en">English</option>
    </select>
  </div>;
}
