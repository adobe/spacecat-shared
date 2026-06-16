import type { page_engine_backend_internal_usermanager_core_domain_GlobalLimitType } from "./page-engine-backend_internal_usermanager_core_domain.GlobalLimitType.js";
import type { page_engine_backend_internal_usermanager_core_domain_TransactionOperation } from "./page-engine-backend_internal_usermanager_core_domain.TransactionOperation.js";
import type { page_engine_backend_internal_usermanager_core_domain_TxProductLimit } from "./page-engine-backend_internal_usermanager_core_domain.TxProductLimit.js";
import type { page_engine_backend_internal_usermanager_core_domain_TransactionServiceType } from "./page-engine-backend_internal_usermanager_core_domain.TransactionServiceType.js";

export type page_engine_backend_internal_usermanager_core_domain_Transaction = {
  amount?: number;
  balance_after?: number;
  balance_before?: number;
  date?: string;
  global_limit_key?: page_engine_backend_internal_usermanager_core_domain_GlobalLimitType;
  id?: string;
  iid?: number;
  operation?: page_engine_backend_internal_usermanager_core_domain_TransactionOperation;
  owner_id?: number;
  owner_name?: string;
  product_limit?: page_engine_backend_internal_usermanager_core_domain_TxProductLimit;
  receipt_id?: number;
  receipt_name?: string;
  reference_transaction_id?: string;
  service_id?: string;
  service_type?: page_engine_backend_internal_usermanager_core_domain_TransactionServiceType;
  title?: string;
  workspace_id?: string;
};
