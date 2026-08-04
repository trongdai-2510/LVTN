const CATEGORY_NAME_SEPARATOR_PATTERN = /([/-])/;
const CATEGORY_NAME_ACRONYM_PATTERN = /^[A-Z0-9]{2,5}$/;
const CATEGORY_NAME_KNOWN_LOWERCASE_ACRONYMS = new Set([
  'ac',
  'ats',
  'cct',
  'cob',
  'dc',
  'ip',
  'led',
  'mcb',
  'mccb',
  'mpe',
  'pvc',
  'rccb',
  'rcbo',
  'rgb',
  'smd'
]);
const CATEGORY_NAME_LOWERCASE_WORD_PATTERN = /^[\p{Ll}\d]+$/u;
const CATEGORY_NAME_UPPERCASE_WORD_PATTERN = /^[\p{Lu}\d]+$/u;

function toTitleCaseWord(value: string) {
  const normalizedValue = value.normalize('NFC');
  const lowerCasedValue = normalizedValue.toLocaleLowerCase('vi-VN');

  return `${lowerCasedValue.charAt(0).toLocaleUpperCase('vi-VN')}${lowerCasedValue.slice(1)}`;
}

function formatCategoryNameToken(token: string) {
  return token
    .split(CATEGORY_NAME_SEPARATOR_PATTERN)
    .map((part) => {
      if (part === '/' || part === '-') {
        return part;
      }

      if (CATEGORY_NAME_ACRONYM_PATTERN.test(part)) {
        return part;
      }

      if (CATEGORY_NAME_KNOWN_LOWERCASE_ACRONYMS.has(part)) {
        return part.toUpperCase();
      }

      if (
        CATEGORY_NAME_UPPERCASE_WORD_PATTERN.test(part) ||
        CATEGORY_NAME_LOWERCASE_WORD_PATTERN.test(part)
      ) {
        return toTitleCaseWord(part);
      }

      return part;
    })
    .join('');
}

export function formatPublicCategoryName(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/g, ' ');

  if (!normalizedValue) {
    return null;
  }

  return normalizedValue
    .split(' ')
    .map((token) => formatCategoryNameToken(token))
    .join(' ');
}
