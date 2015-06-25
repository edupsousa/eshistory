#! /usr/bin/env node
var commander = require("commander"),
    metricsCommand = require("../lib/commands/ProjectMetricsCommand.js"),
    config = {};

commander
    .version("0.0.1")
    .option(
        "-c, --child-processes <n>", "Fork processor intensive actions in <n> processes (Default: 2).",
        parseInt)
    .option("-h, --heap-usage <n>", "Report memory heap usage every <n> seconds (on stderr).", parseInt)
    .option("-v, --verbose", "Verbose output on stderr.")
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

if (commander.childProcesses) {
    config.maxChildProcesses = commander.childProcesses;
} else {
    config.maxChildProcesses = 2;
}

metricsCommand.run(commander.args[0], commander.args[1], config);
