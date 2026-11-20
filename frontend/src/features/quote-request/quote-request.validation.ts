export type QuoteRequestFieldName = 'full_name' | 'phone' | 'email';

export type QuoteRequestFieldErrors = Partial<
  Record<QuoteRequestFieldName, string>
>;

export type QuoteRequestValidationInput = {
  full_name: string;
  phone: string;
  email: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^0\d{9}$/;

export const QUOTE_REQUEST_FIELD_ORDER: QuoteRequestFieldName[] = [
  'full_name',
  'phone',
  'email'
];

export function sanitizeQuoteRequestPhoneInput(value: string) {
  return value.replace(/\D+/g, '').slice(0, 10);
}

export function validateQuoteRequestFields(
  input: QuoteRequestValidationInput
): QuoteRequestFieldErrors {
  const errors: QuoteRequestFieldErrors = {};
  const fullName = input.full_name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();

  if (!fullName) {
    errors.full_name = 'Vui lòng nhập họ và tên.';
  }

  if (!phone) {
    errors.phone = 'Vui lòng nhập số điện thoại.';
  } else if (!PHONE_PATTERN.test(phone)) {
    errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.';
  }

  if (!email) {
    errors.email = 'Vui lòng nhập email.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Email không hợp lệ.';
  }

  return errors;
}

export function extractQuoteRequestFieldErrors(
  details: unknown
): QuoteRequestFieldErrors {
  const errors: QuoteRequestFieldErrors = {};

  if (!details || typeof details !== 'object') {
    return errors;
  }

  const record = details as Record<string, unknown>;

  if (record.field === 'full_name') {
    errors.full_name = 'Vui lòng nhập họ và tên.';
  }

  if (record.field === 'phone') {
    errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.';
  }

  if (record.field === 'email') {
    errors.email = 'Email không hợp lệ.';
  }

  if (Array.isArray(record.validation_errors)) {
    for (const message of record.validation_errors) {
      const text = String(message);

      if (text.includes('phone')) {
        errors.phone = 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.';
      }

      if (text.includes('email')) {
        if (!errors.email || text.includes('not be empty')) {
          errors.email = text.includes('not be empty')
            ? 'Vui lòng nhập email.'
            : 'Email không hợp lệ.';
        }
      }

      if (text.includes('full_name')) {
        if (!errors.full_name || text.includes('not be empty')) {
          errors.full_name = text.includes('not be empty')
            ? 'Vui lòng nhập họ và tên.'
            : 'Họ và tên không hợp lệ.';
        }
      }
    }
  }

  return errors;
}
