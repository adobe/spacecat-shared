import type { page_engine_backend_internal_usermanager_core_domain_GoalDateType } from "./page-engine-backend_internal_usermanager_core_domain.GoalDateType.js";
import type { page_engine_backend_internal_usermanager_core_domain_GoalType } from "./page-engine-backend_internal_usermanager_core_domain.GoalType.js";

export type handlers_internalGoal = {
  /**
   * Set when the goal is objective, will contain dates between date_from and date_to
   * @format date
   * @example "2024-01-01"
   */
  date?: string;
  /**
   * Set when the goal is objective, may be set when the goal is threshold
   * @format date
   * @example "2024-01-01"
   */
  date_from?: string;
  /**
   * Set when the goal is objective, may be set when the goal is threshold
   * @format date
   * @example "2024-02-01"
   */
  date_to?: string;
  /**
   * We can have monthly goals now
   */
  date_type?: page_engine_backend_internal_usermanager_core_domain_GoalDateType;
  id: string;
  metric_id: string;
  metric_name: string;
  name: string;
  project_domain: string;
  type: page_engine_backend_internal_usermanager_core_domain_GoalType;
  /**
   * Is set to upper value when type is threshold and objective value when type is objective
   */
  value?: number;
};
