var ESComplexJS = require('escomplex-js');

function JSMetrics(sourceCode) {
    var analysis = analyseSourceCode(sourceCode);
    return getMetricsFromAnalysis(analysis);
}

function analyseSourceCode(sourceCode) {
    return ESComplexJS.analyse(sourceCode, {});
}

function getMetricsFromAnalysis(analysis) {
    return {
        loc: analysis.aggregate.sloc.logical,
        cyclomatic: analysis.cyclomatic,
        functionCount: analysis.functions.length,
        functions: getMetricsForFunctions(analysis.functions),
        dependencyCount: analysis.dependencies.length
    };
}

function getMetricsForFunctions(functions) {
    var metrics = [];
    functions.forEach(function(fn) {
        metrics.push({
            name: fn.name,
            line: fn.line,
            loc: fn.sloc.logical,
            cyclomatic: fn.cyclomatic,
            params: fn.params
        });
    });
    return metrics;
}

exports = module.exports = JSMetrics;