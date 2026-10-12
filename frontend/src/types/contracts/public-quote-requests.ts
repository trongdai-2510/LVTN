export interface PublicQuoteRequestPayload {
  full_name: string;
  phone: string;
  email: string;
  company_name?: string;
  address?: string;
  message?: string;
  project_name?: string;
  project_context?: string;
  project_requirements?: Array<{
    label: string;
    value: string;
  }>;
  items?: Array<{
    product_group_id: string;
    product_variant_id?: string;
    quantity?: number;
    quantity_raw?: string;
    quantity_unit?: string;
    quantity_state?: 'confirmed' | 'unspecified';
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
    project_name: string | null;
    project_context: string | null;
    project_requirements: Array<{
      label: string;
      value: string;
    }>;
    status: string;
    created_at: string;
  };
  items: Array<{
    id: string;
    quote_request_id: string;
    product_group_id: string;
    product_variant_id: string | null;
    quantity: number | null;
    quantity_raw: string | null;
    quantity_unit: string | null;
    quantity_state: 'confirmed' | 'unspecified';
    public_price_amount_at_request: number | null;
    notes: string | null;
  }>;
}
