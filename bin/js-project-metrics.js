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
    .option('-c, --commits', 'Output commit details.')
    .option('-f, --files', 'Output commits files')
    .option('-m, --metrics', 'Output files metrics')
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
    formatter,
    explorer,
    commits,
    files;

startProgram()
    .then(openRepository)
    .then(getCommits)
    .then(listFiles)
    .then(getComplexity)
    .catch(function (reason) {
        console.error(reason.toString());
    })
    .done(function () {
        showFinishedBanner();
    });

function startProgram() {
    setFormatter();
    setRepositoryPath();
    startBenchmarking();
    return Q(true);
}

function setRepositoryPath() {
    repositoryPath = Path.resolve(Program.args[0]);
    repositoryName = Path.basename(Path.resolve(repositoryPath));
}

function startBenchmarking() {
    benchmarker = new Benchmarker();
}

function setFormatter() {
    formatter = new (require('../lib/MySqlFormatter.js'))();
}

function openRepository() {
    return GitExplorer.open(repositoryPath)
        .then(function (_explorer) {
            explorer = _explorer;
            verboseLog('Opened Git Repository: %s.', repositoryPath)
        });
}

function getCommits() {
    if (!(Program.commits || Program.files || Program.metrics)) return;
    return explorer.getCommits()
        .then(function (_commits) {
            commits = _commits;
            verboseLog('Retrieved %d commits.', commits.length);
            if (Program.commits) {
                print(formatter.commitsHeader());
                commits.forEach(function (commit) {
                    print(formatter.commitEntry(repositoryName, commit));
                });
                print(formatter.commitsFooter());
            }
        })
}

function listFiles() {
    if (!(Program.files || Program.metrics)) return;
    return explorer.listFiles(commits)
        .then(function (_files) {
            files = _files;
            if (Program.verbose) {
                var fileCount = 0;
                for (var commitId in files) {
                    fileCount += files[commitId].length;
                }
                verboseLog('Retrieved %d files from commits.', fileCount);
            }
            if (Program.files) {
                print(formatter.commitFilesHeader());
                for (var commitId in files) {
                    print(formatter.commitFilesEntry(commitId, files[commitId]));
                }
                print(formatter.commitFilesFooter());
            }
        });
}

function getComplexity() {
    if (!Program.metrics) return;
    var fileIndex = 0;
    var complexity = {};
    var walkFiles = explorer.createDistinctFilesWalker(files);
    print(formatter.fileComplexityHeader());
    return walkFiles(function (id, contents, totalFiles) {
        try {
            var fileComplexity = JSMetrics(contents);
            verboseLog('Complexity Calculation: %d of %d files.', fileIndex + 1, totalFiles);
            print(formatter.fileComplexityEntry(id, fileComplexity));
            fileIndex++;
        } catch (error) {
            console.error(error);
        }
    }).then(function () {
        print(formatter.fileComplexityFooter());
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

function print() {
    arguments[0] = arguments[0].trim();
    console.log.apply(this, arguments);
}