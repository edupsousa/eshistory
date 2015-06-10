
function Benchmarker() {
    this.startTime = process.hrtime();

    this.getElapsedTime = function() {
        var diff = process.hrtime(this.startTime);
        return diff[0] + 's ' + (diff[1]/1000000).toFixed(2) + 'ms';
    };

    this.getMemory = function() {
        var currentMemory = memory = process.memoryUsage();
        var result = '********* Memory Usage *********\n';
        result += getMemoryData('RSS', currentMemory.rss) + '\n';
        result += getMemoryData('Heap Total', currentMemory.heapTotal) + '\n';
        result += getMemoryData('Heap Used', currentMemory.heapUsed) + '\n';
        result += '********************************';
        return result;
    };

    function getMemoryData(label, current) {
        return label + ': ' + toMb(current) + 'Mb';
    }

    function toMb(bytes) {
        return (bytes / 1048576).toFixed(2);
    }
}

exports = module.exports = Benchmarker;