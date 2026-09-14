/**
 * `canvas` and `pdf-to-png-converter` are optionalDependencies: npm skips them
 * when a prebuilt binary or build toolchain is unavailable, which made `tsc`
 * fail with TS2307 and broke CI. These shorthand declarations let the compiler
 * resolve the specifiers whether or not the packages are installed.
 *
 * Shorthand form types each module as `any`, so every call site casts the
 * dynamic import to the explicit shapes in ./optional-native.ts. Those
 * interfaces, not these declarations, are what actually type-check the usage.
 */
declare module 'canvas';
declare module 'pdf-to-png-converter';
