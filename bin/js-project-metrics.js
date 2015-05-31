#! /usr/bin/env node
var Path = require('path'),
    Pkg = require(Path.join(__dirname, '../package.json')),
    Program = require('commander'),
    Q = require('q'),
    Benchmarker = require('../lib/Benchmarker.js'),
    GitExplorer = require('../lib/GitExplorer.js'),
    JSMetrics = require('../lib/JSMetrics.js');

Program
    .version(Pkg.version)
    .option('-v, --verbose', 'Verbose output (to stderr).')
    .option('-b, --benchmark', 'Display execution time and memory usage (on stderr).')
    .usage('<repository>')
    .parse(process.argv);

if (Program.args.length !== 1) {
    Program.help();
    return;
}

var repositoryPath,
    repositoryName,
    benchmarker,
    explorer,
    commits,
    files;

startProgram()
    .then(openRepository)
    .then(getCommits)
    .then(listFiles)
    //.then(getContents)
    .then(getComplexity)
    .catch(function(reason) {
        console.error(reason.toString());
    })
    .done(function() {
        showFinishedBanner();
    });

function startProgram() {
    repositoryPath = Path.resolve(Program.args[0]);
    repositoryName = Path.basename(Path.resolve(repositoryPath));
    benchmarker = new Benchmarker();

    return Q(true);
}

function openRepository() {
    return GitExplorer.open(repositoryPath)
        .then(function(_explorer) {
            explorer = _explorer;
            verboseLog('Opened Git Repository: %s.', repositoryPath)
        });
}

function getCommits() {
    return explorer.getCommits()
        .then(function(_commits) {
            commits = _commits;
            verboseLog('Retrieved %d commits.', commits.length);
        })
}

function listFiles() {
    return explorer.listFiles(commits)
        .then(function(_files) {
            files = _files;
            if (Program.verbose) {
                var fileCount = 0;
                for (var commitId in files) {
                    fileCount += files[commitId].length;
                }
                verboseLog('Retrieved %d files from commits.', fileCount);
            }
        });
}

function getComplexity() {
    var fileIndex = 0;
    var complexity = {};
    var walkFiles = explorer.createDistinctFilesWalker(files);
    return walkFiles(function(id, contents, totalFiles) {
        try {
            var fileComplexity = JSMetrics(contents);
            verboseLog('Complexity Calculation: %d of %d files.', fileIndex+1, totalFiles);
            fileIndex++;
        } catch (error) {
            console.error(error);
        }
    }).then(function() {
        verboseLog('Done calculating complexity for all distinct files.')
    });
}

function verboseLog() {
    if (Program.benchmark)
        arguments[0] = benchmarker.getElapsedTime() + '\t' + arguments[0];
    if (Program.verbose)
        console.warn.apply(this, arguments);
}

function showFinishedBanner() {
    if (Program.benchmark) {
        console.warn('%s\tFinished.', benchmarker.getElapsedTime());
        console.warn(benchmarker.getMemory());
    } else {
        verboseLog('Finished.');
    }
}