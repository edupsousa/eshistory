var Path = require('path'),
    Benchmarker = require('./../util/Benchmarker.js'),
    MetricsExtractor = require('./../metrics/MetricsExtractor.js')
    MySqlExporter = require('./../exporter/MySQLScriptFile.js');

var ProjectMetricsCommand = {};

ProjectMetricsCommand.run = function (repositoryPath, outputPath, options) {
    var self = this;

    this.setRepository(repositoryPath);
    this.setOutput(outputPath);
    this.setOptions(options);
    this.startBenchmarker();
    return this.extractProjectMetrics()
        .catch(function (error) {
            throw (error);
        })
        .done(function() {
            self.stopBenchmarker();
            console.warn(self.benchmarker.getMemory());
            self.verboseLog('Finished.');
        });
};

ProjectMetricsCommand.setOptions = function (options) {
    this.showVerboseLog = (options.verbose === true);
    this.showHeapUsage = options.showHeapUsage;
    this.maxChildProcesses = options.maxChildProcesses;
    this.commitFilter = options.commitFilter;
};

ProjectMetricsCommand.setOutput = function (outputPath) {
    try {
        this.exporter = new MySqlExporter(Path.resolve(outputPath));
    } catch (error) {
        console.error(error.toString());
        process.exit(1);
    }
};

ProjectMetricsCommand.setRepository = function (repositoryPath) {
    this.repositoryPath = Path.resolve(repositoryPath);
    this.repositoryName = Path.basename(Path.resolve(this.repositoryPath));
};

ProjectMetricsCommand.startBenchmarker = function () {
    var self = this;
    this.benchmarker = new Benchmarker();

    if (this.showHeapUsage) {
        this.heapUsageFn = setInterval(function() {
            console.warn(self.benchmarker.getElapsedTime() + "\t" + self.benchmarker.getHeapUsage());
        }, self.showHeapUsage * 1000);
    }
};

ProjectMetricsCommand.stopBenchmarker = function () {
    if (this.heapUsageFn)
        clearInterval(this.heapUsageFn);
};

ProjectMetricsCommand.filterCommits = function(commits, references) {
    var filter = this.commitFilter;

    for (var i = 0; i < commits.length; i++) {
        var commit = commits[i];
        commit.extractFiles = true;

        if (filter.onlyPointedByRef) {
            var isReferred = references.some(function(ref) {
                return (ref.target == commit.id);
            });
            if (!isReferred) {
                commit.extractFiles = false;
            }
        }
    }

    return commits;
};

ProjectMetricsCommand.extractProjectMetrics = function () {
    var self = this;

    return this.createExtractor()
        .then(function(extractor) {
            self.exportProject();

            return extractor.getCommits(self.commitFilter.branch)
                .then(function(commits) {
                    self.verboseLog("Extracting references.");
                    return extractor.getReferences(commits)
                        .then(function(references) {
                            commits = self.filterCommits(commits, references);
                            authors = extractor.getUniqueAuthors(commits);
                            self.exportAuthors(authors);
                            self.exportCommits(commits);
                            self.exportReferences(references);
                            self.verboseLog("Extracting files.");
                            return extractor.getFilesFromCommits(commits);
                        });
                })
                .then(function(result) {
                    self.exportPaths(result.paths);
                    self.exportFileEntries(result.entries);
                    self.exportCommitsFiles(result.files);

                    var totalEntries = result.entries.length;
                    var entriesDone = 0;
                    self.verboseLog("Extracting metrics.");
                    return extractor.getMetricsForEntries(result.entries, function(workerIndex) {
                        /*
                        entriesDone++;
                        self.verboseLog("Extracted metrics from %d of %d entries (%d).",
                            entriesDone, totalEntries, workerIndex);
                            */
                    });
                })
                .then(function(metrics) {
                    self.exportMetrics(metrics);
                })
        });
};

ProjectMetricsCommand.createExtractor = function () {
    this.verboseLog('Starting repository extraction for %s.', this.repositoryPath)
    return MetricsExtractor.getExtractorForRepository(this.repositoryPath, this.maxChildProcesses);
};

ProjectMetricsCommand.exportProject = function () {
    this.exporter.exportProject(this.repositoryName);
};

ProjectMetricsCommand.exportAuthors = function (authors) {
    this.verboseLog('Exporting %d authors.', authors.length);
    this.exporter.exportAuthors(authors);
};

ProjectMetricsCommand.exportCommits = function (commits) {
    this.verboseLog('Exporting %d commits.', commits.length);
    this.exporter.exportCommits(commits);
};

ProjectMetricsCommand.exportReferences = function (references) {
    this.verboseLog('Exporting %d references.', references.length);
    this.exporter.exportReferences(references);
};

ProjectMetricsCommand.exportPaths = function(paths) {
    this.verboseLog('Exporting %d paths.', paths.length);
    this.exporter.exportPaths(paths);
};

ProjectMetricsCommand.exportFileEntries = function(fileEntries) {
    this.verboseLog('Exporting %d file entries.', fileEntries.length);
    this.exporter.exportFileEntries(fileEntries);
};

ProjectMetricsCommand.exportCommitsFiles = function(files) {
    this.verboseLog('Exporting %d commits files.', Object.keys(files).length);
    var commitCount = 1;
    for (var commitId in files) {
        this.exporter.exportCommitFiles(commitId, files[commitId]);
        commitCount++;
    }
};

ProjectMetricsCommand.exportMetrics = function(metrics) {
    this.verboseLog('Exporting %d metrics.', metrics.length);
    this.exporter.exportFilesMetrics(metrics);
};

ProjectMetricsCommand.verboseLog = function () {
    if (this.showVerboseLog) {
        arguments[0] = this.benchmarker.getElapsedTime() + '\t' + arguments[0];
        console.warn.apply(this, arguments);
    }
};

exports = module.exports = ProjectMetricsCommand;