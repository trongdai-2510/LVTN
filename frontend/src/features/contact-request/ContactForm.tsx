'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { createPublicContactRequest } from '@/lib/api/public-contact-requests';
import { ErrorState } from '@/components/states/ErrorState';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';

type ContactFormValues = {
  full_name: string;
  phone: string;
  email: string;
  company_name: string;
  message: string;
};

type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>;
type ContactServiceContext = {
  slug: string;
  title: string;
};

type ContactFormProps = {
  serviceContext?: ContactServiceContext | null;
};

const initialValues: ContactFormValues = {
  full_name: '',
  phone: '',
  email: '',
  company_name: '',
  message: ''
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildMessageForSubmit(message: string, serviceContext: ContactServiceContext | null | undefined) {
  const trimmedMessage = message.trim();

  if (!serviceContext) {
    return trimmedMessage;
  }

  return [
    `Dịch vụ quan tâm: ${serviceContext.title}`,
    `Slug dịch vụ: ${serviceContext.slug}`,
    '',
    trimmedMessage
  ].join('\n');
}

export function ContactForm({ serviceContext = null }: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<ContactFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<ContactFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasVisibleError = useMemo(
    () => Object.values(fieldErrors).some(Boolean),
    [fieldErrors]
  );

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;

    setValues((currentValues) => ({
      ...currentValues,
      [name]: value
    }));

    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [name]: undefined
    }));
  }

  function validateForm(currentValues: ContactFormValues): ContactFormErrors {
    const nextErrors: ContactFormErrors = {};

    if (!currentValues.full_name.trim()) {
      nextErrors.full_name = 'Vui lòng nhập họ và tên.';
    }

    if (!currentValues.phone.trim()) {
      nextErrors.phone = 'Vui lòng nhập số điện thoại.';
    }

    if (!currentValues.message.trim()) {
      nextErrors.message = 'Vui lòng nhập nội dung liên hệ.';
    }

    if (currentValues.email.trim() && !isValidEmail(currentValues.email.trim())) {
      nextErrors.email = 'Email không hợp lệ.';
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const nextErrors = validateForm(values);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = (['full_name', 'phone', 'email', 'message'] as const)
        .find((field) => nextErrors[field]);
      if (firstInvalid) {
        formRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${firstInvalid}"]`)?.focus();
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await createPublicContactRequest({
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim() || undefined,
        company_name: values.company_name.trim() || undefined,
        message: buildMessageForSubmit(values.message, serviceContext),
        source_page: serviceContext ? `/lien-he?dich-vu=${encodeURIComponent(serviceContext.slug)}` : '/lien-he'
      });

      setSuccessMessage('Yêu cầu liên hệ đã được gửi thành công.');
      setValues(initialValues);
      setFieldErrors({});
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Không thể gửi yêu cầu liên hệ lúc này.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    'type-input h-12 rounded-sm border px-4 outline-none transition focus:ring-2 focus:ring-primary/15';
  const textareaClassName =
    'type-input min-h-[152px] rounded-sm border px-4 py-3 outline-none transition focus:ring-2 focus:ring-primary/15';

  return (
    <form
      className="w-full self-start border border-borderBlue border-t-4 border-t-primary bg-white p-6 shadow-soft sm:p-8 lg:p-10"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Biểu mẫu trực tuyến</p>
      <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-secondary sm:text-4xl">Gửi yêu cầu</h2>
      <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-body">Để lại thông tin và nội dung cần trao đổi, Song Thanh sẽ tiếp nhận yêu cầu của bạn.</p>

      <div className="mt-8 space-y-6">
        {serviceContext ? (
          <div className="rounded-sm border border-primary/20 bg-primarySoft/60 px-4 py-3">
            <p className="type-caption font-semibold uppercase text-primaryStrong">Dịch vụ đang hỏi</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="type-body-sm font-semibold text-secondary">{serviceContext.title}</p>
              <Link
                className="type-button inline-flex min-h-11 items-center text-primaryStrong transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={`/dich-vu/${serviceContext.slug}`}
              >
                Xem lại dịch vụ
              </Link>
            </div>
          </div>
        ) : null}

        {successMessage ? (
          <SuccessState
            description="Chúng tôi đã nhận thông tin và sẽ liên hệ lại sớm."
            title={successMessage}
          />
        ) : null}

        {errorMessage ? (
          <ErrorState
            description="Kiểm tra lại trường bắt buộc hoặc thử lại sau."
            title={errorMessage}
          />
        ) : null}

        {hasVisibleError ? (
          <ErrorState
            description="Họ và tên, số điện thoại và nội dung liên hệ là các trường bắt buộc."
            title="Vui lòng hoàn thiện thông tin trước khi gửi."
          />
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <FormField error={fieldErrors.full_name} label="Họ và tên" required>
            <input
              autoComplete="name"
              className={[
                inputClassName,
                fieldErrors.full_name
                  ? 'border-red-300 bg-red-50 focus:border-red-400'
                  : 'border-slate-300 bg-white focus:border-primary'
              ].join(' ')}
              name="full_name"
              onChange={handleChange}
              placeholder="Nguyễn Văn A"
              value={values.full_name}
            />
          </FormField>

          <FormField error={fieldErrors.phone} label="Số điện thoại" required>
            <input
              autoComplete="tel"
              className={[
                inputClassName,
                fieldErrors.phone
                  ? 'border-red-300 bg-red-50 focus:border-red-400'
                  : 'border-slate-300 bg-white focus:border-primary'
              ].join(' ')}
              name="phone"
              onChange={handleChange}
              placeholder="0901 234 567"
              inputMode="tel"
              value={values.phone}
            />
          </FormField>

          <FormField error={fieldErrors.email} label="Email">
            <input
              autoComplete="email"
              className={[
                inputClassName,
                fieldErrors.email
                  ? 'border-red-300 bg-red-50 focus:border-red-400'
                  : 'border-slate-300 bg-white focus:border-primary'
              ].join(' ')}
              name="email"
              onChange={handleChange}
              placeholder="example@gmail.com"
              type="email"
              value={values.email}
            />
          </FormField>

          <FormField label="Tên công ty">
            <input
              autoComplete="organization"
              className={[inputClassName, 'border-slate-300 bg-white focus:border-primary'].join(
                ' '
              )}
              name="company_name"
              onChange={handleChange}
              placeholder="Công ty của bạn"
              value={values.company_name}
            />
          </FormField>
        </div>

        <FormField error={fieldErrors.message} label="Nội dung liên hệ" required>
          <textarea
            className={[
              textareaClassName,
              fieldErrors.message
                ? 'border-red-300 bg-red-50 focus:border-red-400'
                : 'border-slate-300 bg-white focus:border-primary'
            ].join(' ')}
            name="message"
            onChange={handleChange}
            placeholder="Tôi muốn nhận tư vấn cho..."
            value={values.message}
          />
        </FormField>

        <Button className="h-12 w-full sm:min-w-48 sm:w-auto" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
        </Button>
      </div>
    </form>
  );
}
