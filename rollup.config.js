import typescript from 'rollup-plugin-typescript2';
import external from 'rollup-plugin-peer-deps-external';
import packageJSON from './package.json';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
      strict: false,
    },
  ],
  plugins: [external(), typescript({ objectHashIgnoreUnknownHack: true, exclude: 'node_modules/**' })],
  external: [packageJSON.peerDependencies || {}],
};
