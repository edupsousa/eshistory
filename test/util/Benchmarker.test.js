var expect = require("chai").expect,
    Benchmarker = require("../../lib/util/Benchmarker.js");

describe("Benchmarker", function() {

    var benchmarker;

    beforeEach(function() {
        benchmarker = new Benchmarker();
    });

    it("getElapsedTime must have the format 0s 0.0ms", function() {
        var elapsedTime = benchmarker.getElapsedTime();
        expect(elapsedTime).to.match(/\d+s\s\d+\.\d+ms/);
    });

    it("getMemory must have RSS, Heap Total and Heap Used", function() {
        var memoryData =  benchmarker.getMemory();

        expect(memoryData)
            .to.contains("RSS")
            .and.to.contains("Heap Total")
            .and.to.contains("Heap Used");
    });

});