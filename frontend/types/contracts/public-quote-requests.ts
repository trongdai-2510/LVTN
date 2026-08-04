export interface PublicQuoteRequestPayload {
  full_name: string;
  phone: string;
  email: string;
  company_name?: string;
  address?: string;
  message?: string;
  items?: Array<{
    product_group_id: string;
    product_variant_id?: string;
    quantity?: number;
    notes?: string;
  }>;
}

export interface PublicQuoteRequestResponse {
  quote_request: {
    id: string;
    full_name: string;
    company_name: string | null;
    phone: string;
    email: string | null;
    address: string | null;
    message: string | null;
    status: string;
    created_at: string;
  };
  items: Array<{
    id: string;
    quote_request_id: string;
    product_group_id: string;
    product_variant_id: string | null;
    quantity: number | null;
    notes: string | null;
  }>;
}
