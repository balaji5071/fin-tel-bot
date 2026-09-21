/**
 * Escapes Telegram legacy Markdown special characters (*, _, `, [) in dynamic user strings.
 * @param {string|number|null|undefined} text
 * @returns {string}
 */
export const escapeMd = (text) => {
  if (text === null || text === undefined) return '';
  return String(text).replace(/[_*`\[]/g, '\\$&');
};
