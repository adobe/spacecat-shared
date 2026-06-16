import type { page_engine_backend_internal_usermanager_core_domain_GoalDateType } from "./page-engine-backend_internal_usermanager_core_domain.GoalDateType.js";
import type { page_engine_backend_internal_usermanager_core_domain_GoalObjectiveValueType } from "./page-engine-backend_internal_usermanager_core_domain.GoalObjectiveValueType.js";
import type { page_engine_backend_internal_usermanager_core_domain_GoalType } from "./page-engine-backend_internal_usermanager_core_domain.GoalType.js";
import type { page_engine_backend_internal_usermanager_core_domain_GoalValue } from "./page-engine-backend_internal_usermanager_core_domain.GoalValue.js";

export type page_engine_backend_internal_usermanager_core_domain_Goal = {
  /**
   * Is set when the goal is objective
   * @format date
   * @example "2024-01-01"
   */
  date_from?: string;
  /**
   * Is set when the goal is objective
   * @format date
   * @example "2024-02-01"
   */
  date_to?: string;
  /**
   * We can have monthly goals now
   */
  date_type?: page_engine_backend_internal_usermanager_core_domain_GoalDateType;
  /**
   * ID is the goal ID in the system
   */
  id: string;
  /**
   * May be null if we have only upper value in the threshold
   */
  lower_value?: number;
  metric_id: string;
  name: string;
  /**
   * ### Single objective value
   * `value` is used for `single` `objective_value_type`
   * ### Multiple objective values
   * `values` is used for `multiple` `objective_value_type`
   */
  objective_value_type?: page_engine_backend_internal_usermanager_core_domain_GoalObjectiveValueType;
  /**
   * ### Threshold goal
   * `upper_value` and `lower_value` are used for threshold goals
   * ### Objective goal
   * `date_type`, `date_from`, `date_to`, `value`, `objective_value_type`, `values` are used for objective goals
   */
  type: page_engine_backend_internal_usermanager_core_domain_GoalType;
  /**
   * Is set when the goal is threshold
   */
  upper_value?: number;
  /**
   * Set when the goal is single objective
   */
  value?: number;
  /**
   * Set when the goal is multiple objective
   */
  values?: Array<page_engine_backend_internal_usermanager_core_domain_GoalValue>;
};
