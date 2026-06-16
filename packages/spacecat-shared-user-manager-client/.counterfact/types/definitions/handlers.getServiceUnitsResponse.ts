export type handlers_getServiceUnitsResponse = {
  available?: number;
  total?: number;
  /**
   * Deprecated: This is left here to ensure backward compatibility. Use Available field instead.
   */
  units?: number;
};
