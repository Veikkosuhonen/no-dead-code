# Dead code search tool

Reports unused exports in JS/TS files.

Supports both ES and commonjs modules out of the box (TODO).

## Usage

In a project's root, run:

```sh
$ npx @veikkosuhonen/no-dead-code
```

Example output

```
src/client/util/common.js: Unused exports: colors, CONFIG_NAME
src/client/pages/FeedbackTarget/tabs/Results/QuestionResults/utils.js: Unused exports: countAverage, countStandardDeviation, countMedian
```

## Caveats

no-dead-code is far from complete, that's why its "best effort". The goal is to cover most typical coding standards, but it will inevitably output false positives and miss unused exports.

### ES modules

Only import & export declarations are supported. Call expressions (dynamic imports) are not.

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


## Todo

- Formatted & colored output
- CLI options for includes/excludes/file extensions
- Path aliases
- Absolute paths
- Dynamic imports
- Deeper usage search
