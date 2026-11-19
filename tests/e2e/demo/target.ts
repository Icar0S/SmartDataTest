/**
 * Where the tour runs: production by default. Point DEMO_BASE_URL at
 * localhost to record a local stack instead, which the config then starts.
 */
export const PRODUCTION_URL = 'https://smart-data-test.vercel.app';
const PRODUCTION_API_URL = 'https://api.smartdatatest.com';

export const baseURL = process.env.DEMO_BASE_URL ?? PRODUCTION_URL;
export const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseURL);

/** API behind that frontend. Only read to report which LLM it runs. */
export const apiURL = process.env.DEMO_API_URL ?? (isLocal ? 'http://127.0.0.1:5000' : PRODUCTION_API_URL);
