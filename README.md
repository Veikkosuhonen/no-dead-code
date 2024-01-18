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

## Todo

- CommonJS modules
- Absolute paths
- Path aliases
- Formatted & colored output
- CLI options for includes/excludes/file extensions
- Deeper usage search
