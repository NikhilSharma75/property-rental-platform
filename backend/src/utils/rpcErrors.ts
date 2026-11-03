const MAP: Record<string, [string, number]> = {
  APP_NOT_FOUND: ["Application not found.", 404],
  FORBIDDEN: ["You do not manage this property.", 403],
  NOT_PENDING: ["Only pending applications can be reviewed.", 409],
  APP_EXPIRED: ["This application has expired.", 409],
  NOT_AVAILABLE: ["This unit or property is no longer available. Another application was approved first.", 409],
  LEASE_ACTIVE: ["This application already has an active lease. End the lease instead.", 409],
};



export function mapRpcError(message: string) {
  const key = Object.keys(MAP).find((k) => message.includes(k));
  const [msg, statusCode] = key ? MAP[key] : ["Something went wrong.", 500];
  return Object.assign(new Error(msg), { statusCode });
}