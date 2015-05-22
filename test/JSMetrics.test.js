var expect = require('chai').expect,
    JSMetrics = require('../lib/JSMetrics.js');

describe('JSMetrics', function() {

    it('Analyse empty source code', function() {
        var metrics = JSMetrics('');
        expect(metrics).to.be.a('object');
        expect(metrics).to.have.all.keys(['loc', 'cyclomatic', 'functionCount']);
        expect(metrics.loc).to.be.equal(0);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(0);
    });

    it('Analyse source code with a function call', function() {
        var metrics = JSMetrics('alert("Hello World");');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(1);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(0);
    });

    it('Analyse source code with a IF statement', function() {
        var metrics = JSMetrics('if (x) { } else { }');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(2);
        expect(metrics.cyclomatic).to.be.equal(2);
        expect(metrics.functionCount).to.be.equal(0);
    });

    it('Analyse source code with a function declaration', function() {
        var metrics = JSMetrics('function foo() {}');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(1);
        expect(metrics.cyclomatic).to.be.equal(1);
        expect(metrics.functionCount).to.be.equal(1);
    });

    it('Analyse source code with a IF statement inside function declaration', function() {
        var metrics = JSMetrics('function foo() { if(x) {}; }');
        expect(metrics).to.be.a('object');
        expect(metrics.loc).to.be.equal(2);
        expect(metrics.cyclomatic).to.be.equal(2);
        expect(metrics.functionCount).to.be.equal(1);
    });

});