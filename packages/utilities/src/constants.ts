// Must be a syntactically valid Mongo ObjectId (24 hex chars) — it's passed
// to `new Types.ObjectId(...)` when audit records are written by server-side
// scripts that don't have a real known-device id. It doesn't need to match
// an actual Device document; audits referencing it just show "Unknown
// device" in the UI, same as any other dangling device reference.
export const SERVER_DEVICE_ID = '77f542a0c09e4b14963440f2';
