// Type declaration for YAML modules imported via @rollup/plugin-yaml.
// The plugin returns the YAML's parsed value as the default export.
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
