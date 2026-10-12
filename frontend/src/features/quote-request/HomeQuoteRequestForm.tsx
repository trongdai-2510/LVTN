'use client';

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react';

import { ErrorState } from '@/components/states/ErrorState';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { createPublicQuoteRequest } from '@/lib/api/public-quote-requests';

import {
  extractQuoteRequestFieldErrors,
  QUOTE_REQUEST_FIELD_ORDER,
  sanitizeQuoteRequestPhoneInput,
  validateQuoteRequestFields
} from './quote-request.validation';

type HomeQuoteFormValues = {
  full_name: string;
  phone: string;
  email: string;
  message: string;
};

type HomeQuoteFormErrors = Partial<Record<keyof HomeQuoteFormValues, string>>;

export type QuoteServiceContext = {
  slug: string;
  title: string;
};

const initialValues: HomeQuoteFormValues = {
  full_name: '',
  phone: '',
  email: '',
  message: ''
};

export function HomeQuoteRequestForm({ serviceContext = null }: { serviceContext?: QuoteServiceContext | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<HomeQuoteFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<HomeQuoteFormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasVisibleError = useMemo(
    () => Object.values(fieldErrors).some(Boolean),
    [fieldErrors]
  );

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    const nextValue =
      name === 'phone' ? sanitizeQuoteRequestPhoneInput(value) : value;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: nextValue
    }));

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: undefined
    }));
  }

  function focusFirstInvalidField(errors: HomeQuoteFormErrors) {
    const firstField = QUOTE_REQUEST_FIELD_ORDER.find((field) => errors[field]);
    if (!firstField) {
      return;
    }

    const target = formRef.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(`[name="${firstField}"]`);
    target?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextErrors = validateQuoteRequestFields(values);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(nextErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await createPublicQuoteRequest({
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        message: serviceContext
          ? [`Dịch vụ quan tâm: ${serviceContext.title}`, `Slug dịch vụ: ${serviceContext.slug}`, values.message.trim()].filter(Boolean).join('\n')
          : values.message.trim() || undefined
      });

      setSuccessMessage('Yêu cầu tư vấn đã được gửi thành công.');
      setValues(initialValues);
      setFieldErrors({});
    } catch (error) {
      if (error instanceof PublicApiError) {
        const nextServerErrors = extractQuoteRequestFieldErrors(error.details);
        if (Object.keys(nextServerErrors).length > 0) {
          setFieldErrors(nextServerErrors);
          focusFirstInvalidField(nextServerErrors);
        }
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể gửi yêu cầu tư vấn lúc này.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    'type-body-sm h-[52px] w-full rounded-xs border px-4 outline-none transition';
  const textareaClassName =
    'type-body-sm min-h-[118px] w-full rounded-xs border px-4 py-4 outline-none transition';

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      {successMessage ? (
        <SuccessState
          description="Đội ngũ Song Thanh sẽ liên hệ lại qua thông tin bạn vừa cung cấp."
          title={successMessage}
        />
      ) : null}

      {errorMessage ? (
        <ErrorState
          description="Kiểm tra lại thông tin bắt buộc hoặc thử lại sau."
          title={errorMessage}
        />
      ) : null}

      {hasVisibleError ? (
        <ErrorState
          description="Họ tên, số điện thoại và email là bắt buộc. Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0."
          title="Vui lòng hoàn thiện thông tin trước khi gửi."
        />
      ) : null}

      {serviceContext ? (
        <p className="border-l-2 border-primary bg-primarySoft/55 px-4 py-3 text-sm leading-relaxed text-secondary">
          Dịch vụ đang hỏi: <span className="font-semibold">{serviceContext.title}</span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <input
            aria-label="Họ và tên"
            className={[
              inputClassName,
              fieldErrors.full_name
                ? 'border-red-300 bg-red-50 text-secondary focus:border-red-400'
                : 'border-transparent bg-panel text-secondary focus:border-primary'
            ].join(' ')}
            name="full_name"
            onChange={handleChange}
            placeholder="Họ và tên"
            required
            value={values.full_name}
          />
          {fieldErrors.full_name ? (
            <p className="type-body-sm mt-2 text-error">{fieldErrors.full_name}</p>
          ) : null}
        </div>

        <div>
          <input
            aria-label="Số điện thoại"
            className={[
              inputClassName,
              fieldErrors.phone
                ? 'border-red-300 bg-red-50 text-secondary focus:border-red-400'
                : 'border-transparent bg-panel text-secondary focus:border-primary'
            ].join(' ')}
            inputMode="numeric"
            maxLength={10}
            name="phone"
            onChange={handleChange}
            pattern="0[0-9]{9}"
            placeholder="Số điện thoại"
            required
            type="tel"
            value={values.phone}
          />
          {fieldErrors.phone ? (
            <p className="type-body-sm mt-2 text-error">{fieldErrors.phone}</p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <input
            aria-label="Email"
            className={[
              inputClassName,
              fieldErrors.email
                ? 'border-red-300 bg-red-50 text-secondary focus:border-red-400'
                : 'border-transparent bg-panel text-secondary focus:border-primary'
            ].join(' ')}
            name="email"
            onChange={handleChange}
            placeholder="Email"
            required
            type="email"
            value={values.email}
          />
          {fieldErrors.email ? (
            <p className="type-body-sm mt-2 text-error">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <textarea
            aria-label="Nội dung cần tư vấn"
            className={[
              textareaClassName,
              'border-transparent bg-panel text-secondary focus:border-primary'
            ].join(' ')}
            name="message"
            onChange={handleChange}
            placeholder="Nội dung cần tư vấn..."
            value={values.message}
          />
        </div>
      </div>

      <Button
        className="mt-4 h-14 w-full uppercase"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu ngay'}
      </Button>
    </form>
  );
}
