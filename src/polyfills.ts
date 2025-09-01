// Ensure Node-style globals are defined in the browser for certain libraries
// Angular v17 automatically includes zone.js, so only define what we need here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).global = (window as any).global || window;


