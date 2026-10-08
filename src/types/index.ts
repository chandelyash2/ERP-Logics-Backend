import { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "BUSINESS_OWNER" | "STAFF" | "ACCOUNTANT";
  companyId?: string | null;
  permissions?: {
    can_create_invoices?: boolean;
    can_view_inventory?: boolean;
    can_add_customers?: boolean;
    can_add_suppliers?: boolean;
    can_record_payments?: boolean;
    can_view_reports?: boolean;
    can_edit_delete_records?: boolean;
    can_manage_settings?: boolean;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  companyId?: string;
}
