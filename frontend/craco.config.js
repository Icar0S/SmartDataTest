module.exports = {
  // With "proxy" in package.json, CRA allows as dev server host only the first
  // non-loopback IPv4 address, and only if it is a private LAN one. When the
  // first adapter is Tailscale (100.x), it passes [undefined] and the server
  // refuses to start ("allowedHosts[0] should be a non-empty string").
  // 'auto' keeps the host check while accepting localhost and IP addresses.
  devServer: (devServerConfig) => {
    const hosts = devServerConfig.allowedHosts;
    if (Array.isArray(hosts) && hosts.some((host) => !host)) {
      devServerConfig.allowedHosts = 'auto';
    }
    return devServerConfig;
  },
  jest: {
    configure: (jestConfig) => {
      jestConfig.roots = [
        '<rootDir>/src',
        '<rootDir>/../tests/frontend',
      ];
      jestConfig.testMatch = [
        '<rootDir>/../tests/frontend/**/*.test.{js,jsx,ts,tsx}',
      ];
      jestConfig.collectCoverageFrom = [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/index.js',
        '!src/reportWebVitals.js',
        '!src/**/*.test.{js,jsx,ts,tsx}',
      ];
      jestConfig.moduleNameMapper = {
        ...jestConfig.moduleNameMapper,
        '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
      };
      jestConfig.modulePaths = ['<rootDir>/node_modules'];
      return jestConfig;
    },
  },
};
