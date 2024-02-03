[![npm version](https://img.shields.io/npm/v/no-dead-code.svg?style=flat)](https://www.npmjs.com/package/@veikkosuhonen/no-dead-code)
[![CI](https://github.com/Veikkosuhonen/no-dead-code/actions/workflows/main.yml/badge.svg)](https://github.com/Veikkosuhonen/no-dead-code/actions/workflows/main.yml)

# no-dead-code

Single command to reports unused exports in JS/TS files.

Supports both ES and CommonJS modules out of the box.

The target audience is developers working on refactoring large codebases. Not for script integration since the output is often inaccurate.

## Usage

In a project's root, run:

```sh
$ npx no-dead-code
```

Example output

```
src/client/util/common.js: Unused exports: colors, CONFIG_NAME
src/client/pages/FeedbackTarget/tabs/Results/QuestionResults/utils.js: Unused exports: countAverage, countStandardDeviation, countMedian
```

## Options

### `--extensions` (`-e`)

Specify which extensions are included.

Default: `mjs cjs js ts tsx jsx`

### `--ignore` (`-i`)

Specify which paths are ignored.

By default, `node_modules`, `.git`, `dist`, `build`, `migrations` are always ignored. Values passed to `-i` are added to these.

### `--no-default-ignore`

Turn off the default ignores `node_modules`, `.git`, `dist`, `build`, `migrations`.

### `--no-node-stdlib`

Do not resolve node standard lib dependencies. They are hardcoded, see `src/index.ts` for the list which may be incomprehensive.

## Caveats

no-dead-code is far from complete, and should never be relied on blindly. The goal is to cover most typical coding standards, but it will inevitably output false positives and miss unused some exports.

### ES modules

Import and export declarations work pretty well. Dynamic imports are considered to import just everything.

### CommonJS

Tracking all require-calls and module.exports assignments is a lot of effort, so only typical use cases are covered.

The following are seen by no-dead-code:
```js
module.exports = foo // sees "default" exported. 

module.exports = { // "foo" and "bar" are seen exported
    foo,
    bar,
}

const foo = require('./foo') // everything imported from './foo'

const {
    foo,
    bar,
} = require('./foo') // "foo" and "bar" imported from './foo'

require('./foo')() // everything imported from './foo'

someFunction(require('./foo')) // everything imported from './foo'
```

### Absolute paths

For absolute paths, the closest parent package.json and js/tsconfig are searched to resolve external dependencies and `compilerOptions.baseUrl`.

The config files are `eval`uated. Do not run this in a codebase that you do not trust.

### Path aliases

TODO

## Todo

- Formatted & colored output
- Deeper usage search
