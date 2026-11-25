/**
 * Which release this build is. Stamped by the deploy pipeline from the git tag;
 * a local build says "dev".
 */
export const APP_VERSION = process.env.REACT_APP_VERSION || 'dev';
export const APP_COMMIT = process.env.REACT_APP_COMMIT || '';

export const versionLabel = () => (APP_VERSION === 'dev' ? 'dev' : `v${APP_VERSION}`);
