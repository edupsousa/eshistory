#! /usr/bin/env node
var commander = require("commander"),
    metricsCommand = require("../lib/commands/ProjectMetricsCommand.js"),
    config = {};

commander
    .version("0.0.1")
    .option("-v, --verbose", "Verbose output on stderr")
    .option("-h, --heap-usage <n>", "Report memory heap usage every <n> seconds (on stderr).", parseInt)
    .usage("[options] <repository> <output-file>")
    .parse(process.argv);

if (commander.args.length !== 2) {
    commander.help();
    return 1;
}

if (commander.verbose)
    config.verbose = true;

if (commander.heapUsage)
    config.showHeapUsage = commander.heapUsage;

metricsCommand.run(commander.args[0], commander.args[1], config);
