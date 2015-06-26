var JSMetrics = require('./JSMetrics.js');

process.on('message', function(message) {
    if (message.command === "metrics") {
        var entry = message.entry;
        var result = {error: false, id: entry.id};
        try {
            result.data = JSMetrics(entry.source);
        } catch (error) {
            result.error = true;
            result.reason = error.toString()
        }
        process.send(result);
    }
});