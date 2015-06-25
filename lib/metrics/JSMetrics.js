var ESComplexJS = require('escomplex-js');

function JSMetrics(sourceCode) {
    var analysis = analyseSourceCode(sourceCode);
    return getMetricsFromAnalysis(analysis);
}

function analyseSourceCode(sourceCode) {
    return ESComplexJS.analyse(sourceCode, {});
}

function getMetricsFromAnalysis(analysis) {
    var aggregate = analysis.aggregate;
    return {
        loc: aggregate.sloc.logical,
        cyclomatic: aggregate.cyclomatic,
        cyclomaticDensity: aggregate.cyclomaticDensity,
        functionCount: analysis.functions.length,
        functions: getMetricsForFunctions(analysis.functions),
        dependencyCount: analysis.dependencies.length,
        maintainability: analysis.maintainability,
        hsOperatorsTotal: aggregate.halstead.operators.total,
        hsOperatorsDistinct: aggregate.halstead.operators.distinct,
        hsOperandsTotal: aggregate.halstead.operands.total,
        hsOperandsDistinct: aggregate.halstead.operands.distinct,
        hsLength: aggregate.halstead.length,
        hsVocabulary: aggregate.halstead.vocabulary,
        hsDifficulty: aggregate.halstead.difficulty,
        hsVolume: aggregate.halstead.volume,
        hsEffort: aggregate.halstead.effort,
        hsBugs: aggregate.halstead.bugs,
        hsTime: aggregate.halstead.time
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
            cyclomaticDensity: fn.cyclomaticDensity,
            params: fn.params,
            hsOperatorsTotal: fn.halstead.operators.total,
            hsOperatorsDistinct: fn.halstead.operators.distinct,
            hsOperandsTotal: fn.halstead.operands.total,
            hsOperandsDistinct: fn.halstead.operands.distinct,
            hsLength: fn.halstead.length,
            hsVocabulary: fn.halstead.vocabulary,
            hsDifficulty: fn.halstead.difficulty,
            hsVolume: fn.halstead.volume,
            hsEffort: fn.halstead.effort,
            hsBugs: fn.halstead.bugs,
            hsTime: fn.halstead.time
        });
    });
    return metrics;
}

exports = module.exports = JSMetrics;