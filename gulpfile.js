'use strict';

let
	argv = require('yargs').argv,
	gulp = require('gulp'),
	gulpLoadPlugins = require('gulp-load-plugins'),
	runSequence = require('run-sequence'),
	plugins = gulpLoadPlugins();

let allSrc  = './src/**/*.js';
let testSrc = './src/**.spec.js';
let e2eSrc  = './src/**.spec.e2e.js';

let libSrc  = [ allSrc, `!${testSrc}`, `!${e2eSrc}` ];
let allJs   = [ './gulpfile.js', allSrc ];


/**
 * --------------------------
 * Watch/Reload Tasks
 * --------------------------
 */

gulp.task('watch-build', (done) => { gulp.watch(allSrc, [ 'build' ]); });
gulp.task('watch-test', (done) => { gulp.watch(allSrc, [ 'test' ]); });
gulp.task('watch-test-all', (done) => { gulp.watch(allSrc, [ 'test-all' ]); });

/**
 * --------------------------
 * Testing Tasks
 * --------------------------
 */

gulp.task('run-tests', [ 'build' ], () => {
	// Gather some args for custom testing
	let conf = {};

	// --bail will cause mocha to stop on first error
	if(argv.bail) { conf.bail = true; }

	// --filter will filter the test files using the glob pattern
	if(null != argv.filter) { conf.grep = argv.filter; }

	return gulp.src(testSrc)
		.pipe(plugins.mocha(conf));

});

gulp.task('run-tests-ci', [ 'build-ci', 'coverage-init' ], () => {

	return gulp.src(testSrc)
		.pipe(plugins.mocha())
		.pipe(plugins.istanbul.writeReports({
			reporters: [ 'text-summary', 'lcov' ]
		}));

});

gulp.task('run-tests-e2e', [ 'build' ], () => {

	return gulp.src(e2eSrc)
		.pipe(plugins.mocha());

});

gulp.task('coverage-init', () => {

	return gulp.src(libSrc)
		// Covering files
		.pipe(plugins.istanbul({
			includeUntested: true
		}))
		// Force `require` to return covered files
		.pipe(plugins.istanbul.hookRequire());

});


/**
 * --------------------------
 * Lint Tasks
 * --------------------------
 */
gulp.task('lint', () => lint(false));
gulp.task('lint-ci', () => lint(true));

function lint(ci) {
	let eslint = gulp.src(allJs)
		// ESLint
		.pipe(plugins.eslint())
		.pipe(plugins.eslint.format());

	if(ci) {
		eslint = eslint.pipe(plugins.eslint.failAfterError());
	}

	return eslint;
}



/**
 * --------------------------
 * Main Tasks
 * --------------------------
 */


/**
 * dev - main development task to watch and build
 */
gulp.task('dev', (done) => {
	runSequence([ 'watch-build', 'build' ], done);
});

/**
 * build - Builds all source
 */
gulp.task('build', [ 'lint' ]);

/**
 * dev-test - Main development task to watch and test
 */
gulp.task('dev-test', (done) => {
	runSequence([ 'watch-test', 'test' ], done);
});

/**
 * dev-test-all - Development task to run all tests (unit + e2e) and watch
 */
gulp.task('dev-test-all', (done) => {
	runSequence([ 'watch-test-all', 'test-all' ], done);
});

// Helper task to directly run the tests
gulp.task('test', [ 'run-tests' ]);

// Helper task to run e2e and unit tests in sequence
gulp.task('test-all', (done) => { runSequence( 'run-tests', 'run-tests-e2e', done); });

/**
 * build-ci - Builds all source in ci-mode, which fails on error
 */
gulp.task('build-ci', [ 'lint-ci' ]);

/**
 * test-ci - Run tests in ci mode with coverage
 */
gulp.task('test-ci', (done) => {
	runSequence('run-tests-ci', done);
});


/**
 * Sets the default task
 */
gulp.task('default', [ 'build' ]);
