'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { ErrorState } from '@/components/states/ErrorState';
import { SuccessState } from '@/components/states/SuccessState';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { formatPublicPrice } from '@/features/product-groups/ProductPrice';
import {
  MAX_QUOTE_REQUEST_ITEM_QUANTITY,
  useSiteShell,
  type QuoteRequestItem
} from '@/features/site-shell/SiteShellProvider';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { createPublicQuoteRequest } from '@/lib/api/public-quote-requests';
import type { PublicQuoteRequestPayload } from '@/types/contracts/public-quote-requests';

import { parseQuoteRequestQuantity } from './quantityParser';

import {
  extractQuoteRequestFieldErrors,
  QUOTE_REQUEST_FIELD_ORDER,
  type QuoteRequestFieldErrors,
  sanitizeQuoteRequestPhoneInput,
  validateQuoteRequestFields
} from './quote-request.validation';

type QuantityState = 'confirmed' | 'unspecified';

function buildItemLabel(item: QuoteRequestItem) {
  const productName = item.product_name?.trim();
  const variantName = item.variant_name?.trim();
  if (productName && variantName && productName.localeCompare(variantName, 'vi', { sensitivity: 'base' }) === 0) {
    return productName;
  }
  return [productName, variantName].filter(Boolean).join(' / ');
}

function buildItemBadge(item: QuoteRequestItem) {
  if (item.request_kind === 'priced') {
    return item.public_price_amount
      ? `Giá công khai khi chọn: ${formatPublicPrice(item.public_price_amount)}`
      : 'Đã có giá công khai';
  }

  if (item.request_kind === 'quote') {
    return 'Cần báo giá';
  }

  return '';
}

function removeRecordKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

export function QuoteRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const emptyCloseRef = useRef<HTMLButtonElement>(null);
  const successCloseRef = useRef<HTMLButtonElement>(null);
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
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [touchedQuantities, setTouchedQuantities] = useState<Record<string, boolean>>({});
  const [quantityStates, setQuantityStates] = useState<Record<string, QuantityState>>({});

  useEffect(() => {
    if (successMessage) successCloseRef.current?.focus();
  }, [successMessage]);

  function quantityDraft(item: QuoteRequestItem) {
    return quantityDrafts[item.key] ?? String(item.quantity);
  }

  function quantityState(item: QuoteRequestItem): QuantityState {
    return quantityStates[item.key] ?? 'confirmed';
  }

  function updateQuantityDraft(item: QuoteRequestItem, nextDraft: string) {
    setQuantityDrafts((current) => ({ ...current, [item.key]: nextDraft }));
    setQuantityStates((current) => ({ ...current, [item.key]: 'confirmed' }));
    setTouchedQuantities((current) => ({ ...current, [item.key]: true }));
    const parsed = parseQuoteRequestQuantity(nextDraft);
    if (parsed.valid) {
      updateQuoteRequestItemQuantity(item.key, parsed.value);
    }
  }

  function setQuantity(item: QuoteRequestItem, quantity: number) {
    const nextValue = String(quantity);
    setQuantityDrafts((current) => ({ ...current, [item.key]: nextValue }));
    setTouchedQuantities((current) => ({ ...current, [item.key]: false }));
    setQuantityStates((current) => ({ ...current, [item.key]: 'confirmed' }));
    updateQuoteRequestItemQuantity(item.key, quantity);
  }

  function removeItem(item: QuoteRequestItem) {
    setQuantityDrafts((current) => removeRecordKey(current, item.key));
    setTouchedQuantities((current) => removeRecordKey(current, item.key));
    setQuantityStates((current) => removeRecordKey(current, item.key));
    removeQuoteRequestItem(item.key);
    if (quote_request_items.length === 1) {
      requestAnimationFrame(() => emptyCloseRef.current?.focus());
    }
  }

  function clearItems() {
    setQuantityDrafts({});
    setTouchedQuantities({});
    setQuantityStates({});
    clearQuoteRequestItems();
    requestAnimationFrame(() => emptyCloseRef.current?.focus());
  }

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
    const value = sanitizeQuoteRequestPhoneInput(
      event.currentTarget.value
    );
    event.currentTarget.value = value;
    clearFieldError('phone');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const form = event.currentTarget;
    const quantityResults = quote_request_items.map((item) =>
      parseQuoteRequestQuantity(quantityDraft(item))
    );
    const firstInvalidQuantity = quantityResults.findIndex(
      (result, index) =>
        quantityState(quote_request_items[index]) === 'confirmed' && !result.valid
    );
    if (firstInvalidQuantity >= 0) {
      setTouchedQuantities((current) => ({
        ...current,
        ...Object.fromEntries(
          quote_request_items.map((item, index) => [
            item.key,
            (
              quantityState(item) === 'confirmed' && !quantityResults[index].valid
            ) || current[item.key] || false
          ])
        )
      }));
      setErrorMessage('Vui lòng sửa số lượng chưa hợp lệ trước khi gửi yêu cầu.');
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLInputElement>(
            `[data-quote-quantity-index="${firstInvalidQuantity}"]`
          )
          ?.focus();
      });
      return;
    }

    setIsSubmitting(true);
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
          ? quote_request_items.map((item, index) => ({
              product_group_id: item.product_group_id,
              product_variant_id: item.product_variant_id,
              quantity:
                quantityState(item) === 'confirmed' && quantityResults[index].valid
                  ? quantityResults[index].value
                  : undefined,
              quantity_raw: quantityDraft(item),
              quantity_state: quantityState(item)
            }))
          : undefined
    };

    try {
      await createPublicQuoteRequest(payload);
      clearItems();
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
        error instanceof PublicApiError && error.code === 'PUBLIC_API_UNAVAILABLE'
          ? 'Mất kết nối. Bản nháp vẫn được giữ để bạn gửi lại.'
          : error instanceof Error
            ? error.message
            : 'Không thể gửi yêu cầu lúc này.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    'type-input h-11 rounded-lg border bg-white px-3 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primarySoft';
  const quantityInputClassName =
    'h-11 w-12 border-0 bg-transparent text-center text-sm font-semibold tabular-nums text-secondary outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary';

  const buildTextFieldClassName = (hasError?: boolean) =>
    [
      inputClassName,
      hasError
        ? 'border-red-300 bg-red-50 text-secondary focus:border-red-400'
        : 'border-slate-300'
    ].join(' ');

  if (successMessage) {
    return (
      <div className="space-y-5 px-5 py-6 sm:px-7">
        <SuccessState
          description="Song Thanh sẽ phản hồi qua thông tin liên hệ bạn đã cung cấp."
          title={successMessage}
        />

        <div className="flex justify-end">
          <button
            className="type-button inline-flex h-12 items-center justify-center rounded-xs px-6 text-primary transition-colors hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={closeQuoteRequest}
            ref={successCloseRef}
            type="button"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  if (quote_request_items.length === 0) {
    return (
      <div className="space-y-5 px-5 py-6 sm:px-7">
        <div className="rounded-lg bg-panel px-4 py-4 text-sm leading-6 text-body">
          Danh sách yêu cầu đang trống. Bạn có thể chọn sản phẩm từ trang sản phẩm
          rồi mở lại mục này.
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            className="type-button inline-flex h-12 items-center justify-center rounded-xs px-6 text-primary transition-colors hover:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={closeQuoteRequest}
            ref={emptyCloseRef}
            type="button"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} ref={formRef}>
      {errorMessage ? (
        <div className="px-5 pt-5 sm:px-7">
          <ErrorState
            description="Kiểm tra lại thông tin bắt buộc hoặc thử lại sau."
            title={errorMessage}
          />
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[minmax(0,0.76fr)_minmax(0,1.24fr)]">
        <section className="min-w-0 bg-panel px-5 py-5 sm:px-7 lg:border-r lg:border-borderSoft lg:py-7" data-quote-products="true">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-secondary">
              Sản phẩm đã chọn <span className="font-medium text-body">({quote_request_items.length})</span>
            </h3>
            <button className="shrink-0 text-xs font-medium text-body underline-offset-4 hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={clearItems} type="button">
              Xóa hết
            </button>
          </div>

          <div className="mt-4">
            {quote_request_items.map((item, itemIndex) => {
              const itemLabel = buildItemLabel(item) || 'Sản phẩm đang chọn';
              const itemBadge = buildItemBadge(item);
              const quantityResult = parseQuoteRequestQuantity(quantityDraft(item));
              const itemQuantityState = quantityState(item);
              const quantityError =
                itemQuantityState === 'confirmed' && touchedQuantities[item.key] && !quantityResult.valid
                  ? quantityResult.message
                  : null;

              return (
                <div className="border-t border-borderBlue/70 py-4 first:border-t-0 first:pt-0" key={item.key}>
                  <p className="text-sm font-semibold leading-6 text-secondary">{itemLabel}</p>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      {itemBadge ? <span className="text-xs font-medium text-primary">{itemBadge}</span> : null}
                      <span className={`${itemBadge ? 'mt-1 ' : ''}block text-xs text-body`}>Số lượng</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-borderBlue bg-white p-0.5">

                      <button
                        aria-label={`Giảm số lượng ${itemLabel}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-lg text-secondary transition-colors hover:bg-primarySoft/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        disabled={item.quantity <= 1}
                        onClick={() => setQuantity(item, item.quantity - 1)}
                        type="button"
                      >
                        -
                      </button>

                      <input
                        aria-label={`Số lượng ${itemLabel}`}
                        aria-describedby={quantityError ? `quote-quantity-error-${item.key}` : undefined}
                        aria-invalid={Boolean(quantityError)}
                        className={`${quantityInputClassName} ${quantityError ? 'bg-red-50 text-error' : ''}`}
                        data-quote-quantity-index={itemIndex}
                        inputMode="numeric"
                        maxLength={32}
                        onBlur={() => {
                          setTouchedQuantities((current) => ({
                            ...current,
                            [item.key]: true
                          }));
                          if (quantityResult.valid) {
                            setQuantity(item, quantityResult.value);
                          }
                        }}
                        onChange={(event) => updateQuantityDraft(item, event.currentTarget.value)}
                        pattern="[0-9]*"
                        type="text"
                        value={quantityDraft(item)}
                      />

                      <button
                        aria-label={`Tăng số lượng ${itemLabel}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-lg text-secondary transition-colors hover:bg-primarySoft/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        disabled={item.quantity >= MAX_QUOTE_REQUEST_ITEM_QUANTITY}
                        onClick={() => setQuantity(item, item.quantity + 1)}
                        type="button"
                      >
                        +
                      </button>
                      </div>
                      <button
                        aria-label={`Xóa ${itemLabel} khỏi danh sách`}
                        className="min-h-11 px-1 text-xs font-medium text-body underline-offset-4 transition-colors hover:text-error hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => removeItem(item)}
                        type="button"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  {quantityError ? (
                      <div className="mt-2 space-y-2">
                        <p
                          className="text-[12px] font-medium leading-5 text-red-700"
                          id={`quote-quantity-error-${item.key}`}
                          role="alert"
                        >
                          {quantityError}
                        </p>
                        <button
                          className="text-[12px] font-bold text-primary underline underline-offset-2"
                          onClick={() => {
                            setQuantityStates((current) => ({
                              ...current,
                              [item.key]: 'unspecified'
                            }));
                            setTouchedQuantities((current) => ({
                              ...current,
                              [item.key]: false
                            }));
                          }}
                          type="button"
                        >
                          Chưa xác định số lượng — nhờ tư vấn
                        </button>
                      </div>
                    ) : itemQuantityState === 'unspecified' ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        Đã ghi nhận “{quantityDraft(item)}” là nội dung cần xác nhận lại.{' '}
                        <button
                          className="font-bold text-primary underline underline-offset-2"
                          onClick={() => {
                            setQuantityStates((current) => ({
                              ...current,
                              [item.key]: 'confirmed'
                            }));
                            requestAnimationFrame(() => {
                              formRef.current
                                ?.querySelector<HTMLInputElement>(
                                  `[data-quote-quantity-index="${itemIndex}"]`
                                )
                                ?.focus();
                            });
                          }}
                          type="button"
                        >
                          Nhập lại số
                        </button>
                      </div>
                    ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 px-5 py-5 sm:px-7 lg:py-7" data-quote-contact-fields="true">
          <h3 className="text-base font-semibold text-secondary">Thông tin liên hệ</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField error={fieldErrors.full_name} label="Họ và tên" required>
              <input
                autoComplete="name"
                className={buildTextFieldClassName(Boolean(fieldErrors.full_name))}
                id="quote-full-name"
                name="full_name"
                onChange={() => clearFieldError('full_name')}
                required
              />
            </FormField>
            <FormField error={fieldErrors.phone} label="Số điện thoại" required>
              <input
                autoComplete="tel"
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
            <div className="sm:col-span-2">
              <FormField error={fieldErrors.email} label="Email" required>
                <input
                  autoComplete="email"
                  className={buildTextFieldClassName(Boolean(fieldErrors.email))}
                  id="quote-email"
                  name="email"
                  onChange={() => clearFieldError('email')}
                  required
                  type="email"
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Nội dung yêu cầu">
                <textarea
                  className="type-input min-h-24 rounded-lg border border-slate-300 px-3 py-3 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primarySoft"
                  id="quote-message"
                  maxLength={5_000}
                  name="message"
                />
              </FormField>
            </div>
          </div>

          <details className="group mt-5 border-t border-borderSoft pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              Thông tin bổ sung
              <svg aria-hidden="true" className="h-4 w-4 transition-transform duration-150 group-open:rotate-180" fill="none" viewBox="0 0 24 24">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            </summary>
            <div className="grid gap-4 pb-2 pt-3 sm:grid-cols-2">
              <FormField label="Công ty">
                <input className={buildTextFieldClassName(false)} id="quote-company-name" name="company_name" />
              </FormField>
              <FormField label="Địa chỉ">
                <input className={buildTextFieldClassName(false)} id="quote-address" name="address" />
              </FormField>
            </div>
          </details>
        </section>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-4 border-t border-borderSoft bg-white px-5 py-3 sm:justify-between sm:px-7 sm:py-4">
        <span className="hidden text-xs text-body sm:block">{quote_request_items.length} sản phẩm đã chọn</span>
        <Button className="w-full sm:w-auto" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
        </Button>
      </div>
    </form>
  );
}
