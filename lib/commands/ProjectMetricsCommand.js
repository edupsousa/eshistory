var Commander = require('commander'),
    Path = require('path'),
    Package = require(Path.join(__dirname, '../../package.json')),
    Benchmarker = require('./../util/Benchmarker.js'),
    MetricsExtractor = require('./../metrics/MetricsExtractor.js')
    MySqlExporter = require('./../exporter/MySQLScriptFile.js');

var ProjectMetricsCommand = {};

ProjectMetricsCommand.run = function () {
    var self = this;
    this.parseCommandLineArguments();
    if (this.incorrectCommandLineArguments())
        return;
    this.setCommandConfiguration();
    this.startBenchmarking();
    return this.processActions()
        .catch(function (error) {
            throw (error);
        })
        .done(function() {
            console.warn(self.benchmarker.getMemory());
            self.verboseLog('Finished.');
        });
};

ProjectMetricsCommand.parseCommandLineArguments = function () {
    Commander
        .version(Package.version)
        .option("-v, --verbose", "Verbose output (to stderr).")
        .option("--save-commits <file>", "Save commits to JSON.", false)
        .option("--load-commits <file>", "Load commits from JSON.", false)
        .option("--save-files <file>", "Save files to JSON.", false)
        .option("--load-files <file>", "Load files from JSON.", false)
        .usage("[options] <repository> <output-file>")
        .parse(process.argv);
};

ProjectMetricsCommand.incorrectCommandLineArguments = function () {
    if (Commander.args.length !== 2) {
        Commander.help();
        return true;
    }
    return false;
};

ProjectMetricsCommand.setCommandConfiguration = function () {
    this.setVerbosity();
    this.setExporter();
    this.setRepositoryConfig();
};

ProjectMetricsCommand.setVerbosity = function () {
    this.showVerboseLog = Commander.verbose;
};

ProjectMetricsCommand.setExporter = function () {
    try {
        this.exporter = new MySqlExporter(Path.resolve(Commander.args[1]));
    } catch (error) {
        console.error(error.toString());
        process.exit(1);
    }
};

ProjectMetricsCommand.setRepositoryConfig = function () {
    this.repositoryPath = Path.resolve(Commander.args[0]);
    this.repositoryName = Path.basename(Path.resolve(this.repositoryPath));
};

ProjectMetricsCommand.startBenchmarking = function () {
    this.benchmarker = new Benchmarker();
};

ProjectMetricsCommand.processActions = function () {
    var promise = this.createExtractor();

    this.exportProject();

    promise = promise.then(this.getCommits.bind(this));
    promise = promise.then(this.exportCommits.bind(this));
    promise = promise.then(this.getFiles.bind(this));
    promise = promise.then(this.exportFiles.bind(this));
    promise = promise.then(this.getMetrics.bind(this));
    promise = promise.then(this.exportMetrics.bind(this));

    return promise;
};

ProjectMetricsCommand.createExtractor = function () {
    var self = this;
    self.verboseLog('Starting repository extraction for %s.', self.repositoryPath)
    return MetricsExtractor.getExtractorForRepository(self.repositoryPath)
        .then(function (extractor) {
            self.verboseLog('Repository %s successfully opened.');
            self.extractor = extractor;
        });
};

ProjectMetricsCommand.getCommits = function () {
    var self = this;
    self.verboseLog('Starting commits and authors extraction.');

    if (Commander.loadCommits) {
        var result = JSON.parse(require('fs').readFileSync(Commander.loadCommits));
        self.commits = result.commits;
        self.authors = result.authors;
        return;
    }

    return self.extractor.getCommitsAndAuthors()
        .then(function (result) {
            self.verboseLog('Successfully extracted %d commits and %d authors.',
                result.commits.length, result.authors.length);
            self.commits = result.commits;
            self.authors = result.authors;
            if (Commander.saveCommits) {
                require('fs').writeFile(Commander.saveCommits, JSON.stringify(result));
            }
        });
};

ProjectMetricsCommand.exportProject = function () {
    this.exporter.exportProject(this.repositoryName);
};

ProjectMetricsCommand.exportCommits = function () {
    this.exportAuthors();
    this.verboseLog('Exporting commits.')
    this.exporter.exportCommits(this.commits);
};

ProjectMetricsCommand.exportAuthors = function () {
    this.verboseLog('Exporting authors.')
    this.exporter.exportAuthors(this.authors);
};

ProjectMetricsCommand.getFiles = function () {
    var self = this;

    if (Commander.loadFiles) {
        var result = JSON.parse(require('fs').readFileSync(Commander.loadFiles));
        self.paths = result.paths;
        self.fileEntries = result.entries;
        self.files = result.files;
        return;
    }

    self.verboseLog('Extracting commits files.');
    return self.extractor.getFilesFromCommits(self.commits)
        .then(function (result) {
            self.verboseLog('Extracted %d commits files. With %d distinct paths and %d distinct entries.',
                result.filesLength, result.paths.length, result.entries.length);
            self.paths = result.paths;
            self.fileEntries = result.entries;
            self.files = result.files;
            if (Commander.saveFiles) {
                require('fs').writeFile(Commander.saveFiles, JSON.stringify(result));
            }
        });
};

ProjectMetricsCommand.exportPaths = function() {
    this.verboseLog('Exporting paths');
    this.exporter.exportPaths(this.paths);
};

ProjectMetricsCommand.exportFileEntries = function() {
    this.verboseLog('Exporting file entries');
    this.exporter.exportFileEntries(this.fileEntries);
};

ProjectMetricsCommand.exportCommitsFiles = function() {
    this.verboseLog('Exporting commits Files.')
    var commitCount = 1;
    for (var commitId in this.files) {
        this.verboseLog('Writing commit %d of %d files.', commitCount, this.commits.length);
        this.exporter.exportCommitFiles(commitId, this.files[commitId]);
        commitCount++;
    }
};

ProjectMetricsCommand.exportFiles = function() {
    this.exportPaths();
    this.exportFileEntries();
    this.exportCommitsFiles();
};

ProjectMetricsCommand.getMetrics = function() {
    var self = this;
    var successCount = 0;
    var errorCount = 0;

    self.verboseLog('Extracting metrics from file entries.');
    return self.extractor.getMetricsForEntries(self.fileEntries, function(fileMetrics, totalFiles) {
        if (fileMetrics.error) {
            errorCount++;
        } else {
            successCount++;
        }
        self.verboseLog('Extracted %d of %d entries metrics.', successCount+errorCount, totalFiles);
    }).then(function(metrics) {
        self.verboseLog('Finished metrics extraction. Success: %d - Error: %d', successCount, errorCount);
        self.metrics = metrics;
    });
};

ProjectMetricsCommand.exportMetrics = function() {
    this.verboseLog('Exporting metrics.')
    this.exporter.exportFilesMetrics(this.metrics);
};

ProjectMetricsCommand.verboseLog = function () {
    if (this.showVerboseLog || this.showVeryVerboseLog) {
        arguments[0] = this.benchmarker.getElapsedTime() + '\t' + arguments[0];
        console.warn.apply(this, arguments);
    }
};

exports = module.exports = ProjectMetricsCommand;