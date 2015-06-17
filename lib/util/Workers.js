var Q = require('q'),
    cp = require('child_process');

function Workers(numbeOfInstances, modulePath) {
    this.workers = [];
    for (var i = 0; i < numbeOfInstances; i++) {
        this.workers[i] = cp.fork(modulePath);
    }
}

Workers.prototype.killAll = function() {
    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].kill();
    }
};

Workers.prototype.configure = function(configuration) {
    var self = this;
    var deferred = Q.defer();
    var answersCount = 0;
    var configListener = function(message) {
        if (message === "configured") {
            answersCount++;
        } else {
            deferred.reject();
        }

        if (answersCount === self.workers.length) {
            for (var i = 0; i < self.workers.length; i++) {
                self.workers[i].removeListener('message', configListener);
            }
            deferred.resolve(true);
        }
    };

    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].on('message', configListener);
        this.workers[i].send({
            command: 'configure',
            value: configuration
        });
    }

    return deferred.promise;
}

Workers.prototype.doWork = function(workToDo, responseCallback) {
    var self = this;
    var deferred = Q.defer();
    var responsesExpected = workToDo.length;

    var responseListener = function(worker, message) {
        responseCallback(message);

        if (workToDo.length > 0)
            worker.send(workToDo.shift());

        responsesExpected--;
        if (responsesExpected === 0) {
            for (var i = 0; i < this.workers; i++) {
                self.workers[i].removeListener('message', responseListener);
            }
            deferred.resolve(true);
        }
    };

    for (var i = 0; i < this.workers.length; i++) {
        this.workers[i].on('message', responseListener.bind(null, this.workers[i]));
        if (workToDo.length > 0)
            this.workers[i].send(workToDo.shift());
    }

    return deferred.promise;
};

exports = module.exports = Workers;