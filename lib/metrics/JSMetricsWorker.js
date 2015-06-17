var JSMetrics = require('./JSMetrics.js');

process.on('message', function(message) {

    var result = {error: false, id: message.id, total: message.total};
    try {
        result.data = JSMetrics(message.source);
    } catch (error) {
        result.error = true;
        result.reason = error.toString()
    }
    process.send(result);
});