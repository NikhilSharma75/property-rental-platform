/**
 * Safety cap for list endpoints that return "everything a user owns".
 * It stops one account with thousands of rows from loading them all in a single response.
 * Proper cursor pagination is the long-term fix; this keeps the current API shape unchanged.
 */
export const LIST_HARD_CAP = 500;
