export type handlers_TransactionsListForm = {
  /**
   * Must have YYYY-MM-DD format
   * @example "2023-10-24"
   */
  end?: string;
  /**
   * Must be debit or credit
   * @example ["debit","credit"]
   */
  operations?: Array<string>;
  /**
   * @example [123,456]
   */
  owners?: Array<number>;
  /**
   * @example [123,456]
   */
  receipts?: Array<number>;
  /**
   * Must be seo_workflow, job_hourly, job_fixed or service_fee
   * @example ["seo_workflow","job_hourly","job_fixed","service_fee"]
   */
  service_types?: Array<string>;
  /**
   * Must have YYYY-MM-DD format
   * @example "2023-10-24"
   */
  start?: string;
  /**
   * @example "some title"
   */
  title?: string;
  /**
   * @example ["eab40b25-ec97-4efb-91ea-dbcc6153a721","eab40b25-ec97-4efb-91ea-dbcc6153a722"]
   */
  workspaces?: Array<string>;
};
