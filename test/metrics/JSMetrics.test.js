var expect = require('chai').expect,
    JSMetrics = require('../../lib/metrics/JSMetrics.js');

describe('JSMetrics', function() {

    it('Analyse empty source code', function() {
        var metrics = JSMetrics('');
        expect(metrics).to.be.a('object');
        expect(metrics).to.have.all.keys(['loc', 'cyclomatic', 'functionCount', 'functions', 'dependencyCount']);
        expect(metrics.loc).to.be.equal(0);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(0);
        expect(metrics.dependencyCount).to.be.equal(0);
        expect(metrics.functions).to.be.an('array')
            .with.lengthOf(0);
    });

    it('Analyse source code with a function call', function() {
        var metrics = JSMetrics('alert("Hello World");');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(1);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(0);
        expect(metrics.dependencyCount).to.be.equal(0);
        expect(metrics.functions).to.be.an('array')
            .with.lengthOf(0);
    });

    it('Analyse source code with a dependency', function() {
        var metrics = JSMetrics('var other = require("otherModule.js");');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(1);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(0);
        expect(metrics.dependencyCount).to.be.equal(1);
        expect(metrics.functions).to.be.an('array')
            .with.lengthOf(0);
    });

    it('Analyse source code with a IF statement', function() {
        var metrics = JSMetrics('if (x) { } else { }');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(2);
        expect(metrics.cyclomatic).to.be.equal(2);
        expect(metrics.functionCount).to.be.equal(0);
        expect(metrics.functions).to.be.an('array')
            .with.lengthOf(0);
    });

    it('Analyse source code with a function declaration', function() {
        var metrics = JSMetrics('function foo() {}');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(1);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(1);
        expect(metrics.functions).to.be.an('array')
            .with.lengthOf(1);
        var fn = metrics.functions[0];
        expect(fn).to.have.all.keys(['name','line','loc','cyclomatic','params']);
        expect(fn.name).to.be.equal('foo');
        expect(fn.line).to.be.equal(1);
        expect(fn.loc).to.be.equal(0);
        expect(fn.cyclomatic).to.be.equal(1);
        expect(fn.params).to.be.equal(0);
    });

    it('Analyse source code with a IF statement inside function declaration', function() {
        var metrics = JSMetrics('function foo(bar) { if(x) {}; }');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(2);
        expect(metrics.cyclomatic).to.be.equal(2);
        expect(metrics.functionCount).to.be.equal(1);
        var fn = metrics.functions[0];
        expect(fn.name).to.be.equal('foo');
        expect(fn.line).to.be.equal(1);
        expect(fn.loc).to.be.equal(1);
        expect(fn.cyclomatic).to.be.equal(2);
        expect(fn.params).to.be.equal(1);
    });

});