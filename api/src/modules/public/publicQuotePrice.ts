type PublicVariantPrice = {
  public_price_mode: string;
  public_price_amount: number | null;
};

export function publicPriceAmountAtRequest(
  variant: PublicVariantPrice | null | undefined
): number | null {
  const amount = Number(variant?.public_price_amount);
  return variant?.public_price_mode === 'public_price' &&
    Number.isSafeInteger(amount) && amount > 0 && amount <= 2_147_483_647
    ? amount
    : null;
}
