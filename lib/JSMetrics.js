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
        functionCount: analysis.functions.length
    };
}

exports = module.exports = JSMetrics;