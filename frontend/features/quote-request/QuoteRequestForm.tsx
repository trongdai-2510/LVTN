'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { ErrorState } from '@/components/states/ErrorState';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { useSiteShell, type QuoteRequestItem } from '@/features/site-shell/SiteShellProvider';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { createPublicQuoteRequest } from '@/lib/api/public-quote-requests';
import type { PublicQuoteRequestPayload } from '@/types/contracts/public-quote-requests';

import {
  extractQuoteRequestFieldErrors,
  QUOTE_REQUEST_FIELD_ORDER,
  type QuoteRequestFieldErrors,
  sanitizeQuoteRequestPhoneInput,
  validateQuoteRequestFields
} from './quote-request.validation';

function buildItemLabel(item: QuoteRequestItem) {
  return [item.product_name, item.variant_name].filter(Boolean).join(' / ');
}

function buildItemBadge(item: QuoteRequestItem) {
  if (item.request_kind === 'priced') {
    return 'Có giá tham khảo';
  }

  if (item.request_kind === 'quote') {
    return 'Cần báo giá';
  }

  return 'Gửi yêu cầu';
}

export function QuoteRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const {
    clearQuoteRequestItems,
    closeQuoteRequest,
    quote_request_items,
    removeQuoteRequestItem,
    updateQuoteRequestItemQuantity
  } = useSiteShell();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<QuoteRequestFieldErrors>({});

  function focusFirstInvalidField(errors: QuoteRequestFieldErrors) {
    const firstField = QUOTE_REQUEST_FIELD_ORDER.find((field) => errors[field]);
    if (!firstField) {
      return;
    }

    const target = formRef.current?.querySelector<HTMLInputElement>(
      `[name="${firstField}"]`
    );
    target?.focus();
  }

  function clearFieldError(field: keyof QuoteRequestFieldErrors) {
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined
    }));
  }

  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    event.currentTarget.value = sanitizeQuoteRequestPhoneInput(
      event.currentTarget.value
    );
    clearFieldError('phone');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const normalizedValues = {
      full_name: String(formData.get('full_name') || '').trim(),
      phone: sanitizeQuoteRequestPhoneInput(String(formData.get('phone') || '')),
      email: String(formData.get('email') || '').trim()
    };
    const nextErrors = validateQuoteRequestFields(normalizedValues);
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(nextErrors);
      setIsSubmitting(false);
      return;
    }

    const payload: PublicQuoteRequestPayload = {
      full_name: normalizedValues.full_name,
      phone: normalizedValues.phone,
      company_name: String(formData.get('company_name') || '').trim() || undefined,
      email: normalizedValues.email,
      address: String(formData.get('address') || '').trim() || undefined,
      message: String(formData.get('message') || '').trim() || undefined,
      items:
        quote_request_items.length > 0
          ? quote_request_items.map((item) => ({
              product_group_id: item.product_group_id,
              product_variant_id: item.product_variant_id,
              quantity: item.quantity
            }))
          : undefined
    };

    try {
      await createPublicQuoteRequest(payload);
      clearQuoteRequestItems();
      setFieldErrors({});
      setSuccessMessage('Yêu cầu đã được ghi nhận.');
      form.reset();
    } catch (error) {
      if (error instanceof PublicApiError) {
        const nextServerErrors = extractQuoteRequestFieldErrors(error.details);
        if (Object.keys(nextServerErrors).length > 0) {
          setFieldErrors(nextServerErrors);
          focusFirstInvalidField(nextServerErrors);
        }
      }

      setErrorMessage(
        error instanceof Error ? error.message : 'Không thể gửi yêu cầu lúc này.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    'type-input h-11 rounded-sm border px-4 outline-none focus:border-primary';
  const quantityInputClassName =
    'h-10 w-16 rounded-xs border border-slate-300 text-center text-[14px] font-semibold text-secondary outline-none focus:border-primary';

  const buildTextFieldClassName = (hasError?: boolean) =>
    [
      inputClassName,
      hasError
        ? 'border-red-300 bg-red-50 text-secondary focus:border-red-400'
        : 'border-slate-300'
    ].join(' ');

  if (successMessage) {
    return (
      <div className="space-y-5">
        <SuccessState
          description="Song Thanh sẽ phản hồi qua thông tin liên hệ bạn đã cung cấp."
          title={successMessage}
        />

        <div className="flex justify-end">
          <Button onClick={closeQuoteRequest} type="button" variant="ghost">
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  if (quote_request_items.length === 0) {
    return (
      <div className="space-y-5">
        <div className="rounded-sm border border-borderSoft bg-subtle px-4 py-4 text-[14px] leading-6 text-body">
          Danh sách yêu cầu đang trống. Hãy thêm sản phẩm từ trang chi tiết hoặc
          danh mục, sau đó quay lại icon danh sách để gửi một lượt.
        </div>

        <div className="flex justify-end">
          <Button onClick={closeQuoteRequest} type="button" variant="ghost">
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit} ref={formRef}>
      {errorMessage ? (
        <ErrorState
          description="Kiểm tra lại thông tin bắt buộc hoặc thử lại sau."
          title={errorMessage}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-bold leading-6 text-secondary">
              Sản phẩm đã chọn ({quote_request_items.length})
            </h3>
          </div>

          <Button onClick={clearQuoteRequestItems} type="button" variant="ghost">
            Xóa hết
          </Button>
        </div>

        <div className="rounded-sm border border-borderSoft bg-subtle px-4 py-4">
          <div className="space-y-3">
            {quote_request_items.map((item) => {
              const itemLabel = buildItemLabel(item) || 'Sản phẩm đang chọn';
              const itemBadge = buildItemBadge(item);

              return (
                <div
                  className="flex flex-col gap-3 border-t border-primary/12 pt-3 first:border-t-0 first:pt-0 md:flex-row md:items-center md:justify-between"
                  key={item.key}
                >
                  <div className="min-w-0 space-y-2">
                    <p className="text-[15px] font-bold leading-6 text-secondary">
                      {itemLabel}
                    </p>

                    {itemBadge ? (
                      <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold text-primaryStrong">
                        {itemBadge}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 md:justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-body">
                        Số lượng
                      </span>

                      <button
                        aria-label={`Giảm số lượng ${itemLabel}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xs border border-borderSoft bg-white text-[18px] font-bold text-secondary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 md:h-10 md:w-10"
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          updateQuoteRequestItemQuantity(item.key, item.quantity - 1)
                        }
                        type="button"
                      >
                        -
                      </button>

                      <input
                        className={quantityInputClassName}
                        min={1}
                        onChange={(event) =>
                          updateQuoteRequestItemQuantity(
                            item.key,
                            Number(event.currentTarget.value || 1)
                          )
                        }
                        type="number"
                        value={item.quantity}
                      />

                      <button
                        aria-label={`Tăng số lượng ${itemLabel}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xs border border-borderSoft bg-white text-[18px] font-bold text-secondary transition hover:border-primary hover:text-primary md:h-10 md:w-10"
                        onClick={() =>
                          updateQuoteRequestItemQuantity(item.key, item.quantity + 1)
                        }
                        type="button"
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="text-[13px] font-semibold text-body transition hover:text-primary"
                      onClick={() => removeQuoteRequestItem(item.key)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField error={fieldErrors.full_name} label="Họ và tên" required>
          <input
            className={buildTextFieldClassName(Boolean(fieldErrors.full_name))}
            id="quote-full-name"
            name="full_name"
            onChange={() => clearFieldError('full_name')}
            required
          />
        </FormField>
        <FormField error={fieldErrors.phone} label="Số điện thoại" required>
          <input
            className={buildTextFieldClassName(Boolean(fieldErrors.phone))}
            id="quote-phone"
            inputMode="numeric"
            maxLength={10}
            name="phone"
            onChange={handlePhoneChange}
            pattern="0[0-9]{9}"
            required
            type="tel"
          />
        </FormField>
        <FormField label="Công ty">
          <input
            className={buildTextFieldClassName(false)}
            id="quote-company-name"
            name="company_name"
          />
        </FormField>
        <FormField error={fieldErrors.email} label="Email" required>
          <input
            className={buildTextFieldClassName(Boolean(fieldErrors.email))}
            id="quote-email"
            name="email"
            onChange={() => clearFieldError('email')}
            required
            type="email"
          />
        </FormField>
      </div>

      <FormField label="Địa chỉ">
        <input
          className={buildTextFieldClassName(false)}
          id="quote-address"
          name="address"
        />
      </FormField>

      <FormField label="Nội dung yêu cầu">
        <textarea
          className="type-input min-h-28 rounded-sm border border-slate-300 px-4 py-3 outline-none focus:border-primary"
          id="quote-message"
          name="message"
        />
      </FormField>

      <div className="flex flex-wrap justify-end gap-3">
        <Button onClick={closeQuoteRequest} type="button" variant="ghost">
          Đóng
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
        </Button>
      </div>
    </form>
  );
}
