export interface PublicContactRequestPayload {
  full_name: string;
  phone: string;
  email?: string;
  company_name?: string;
  message: string;
  source_page?: string;
}

export interface PublicContactRequestResponse {
  contact_request: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    company_name: string | null;
    message: string;
    source_page: string | null;
    status: string;
    created_at: string;
  };
}
