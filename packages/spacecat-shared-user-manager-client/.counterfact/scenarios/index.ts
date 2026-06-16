import type { Scenario } from "../types/_.context.js";

/**
 * Scenario scripts are plain TypeScript functions that receive the live REPL
 * environment and can read or mutate server state. Run them from the REPL with:
 *   .scenario <functionName>
 */

/**
 * Read or mutate the root context (same object routes see as $.context):
 *   $.context.<property> = <value>;
 *
 * Load a context for a specific path:
 *   const petsCtx = $.loadContext("/pets");
 *
 * Store a pre-configured route builder for later use in the REPL:
 *   $.routes.myRequest = $.route("/pets").method("get");
 */

/**
 * startup() runs automatically when the server initializes, right before the
 * REPL starts. Use it to seed dummy data so the server is ready to use
 * immediately. It receives the same $ argument as all other scenario functions.
 *
 * Tip: delegate to other scenario functions and pass $ along so each function
 * stays focused on a single concern. You can also pass additional arguments to
 * configure them, e.g. addPets($, 20, "dog").
 *
 * If you don't need a startup scenario, delete this function or leave it empty.
 */
export const startup: Scenario = ($) => {
  void $;
};

/**
 * An example scenario. To use it in the REPL, type:
 *   .scenario help
 */
export const help: Scenario = ($) => {
  void $;

  console.log(
    [
      "Scenarios are functions that populate the context object",
      "and / or the REPL environment. They are intended to",
      "populate your environment with specific data and",
      "configurations for testing purposes.",
    ].join("\n"),
  );

  console.log(
    "\nScenarios (including this one) are defined in the ./scenarios directory.",
  );
};
