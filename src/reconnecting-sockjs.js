"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ReconnectingSockJS = /** @class */ (function () {
    function ReconnectingSockJS(url, protocols, options) {
        var _this = this;
        this.url = url;
        this.protocols = protocols;
        this.options = options;
        this.protocol = null;
        this.forcedClose = false;
        this.timedOut = false;
        this.eventTarget = document.createElement('div');
        this.addEventListener = this.eventTarget.addEventListener.bind(this.eventTarget);
        this.removeEventListener = this.eventTarget.removeEventListener.bind(this.eventTarget);
        this.dispatchEvent = this.eventTarget.dispatchEvent.bind(this.eventTarget);
        this.refresh = function () {
            if (this.ws) {
                this.ws.close();
            }
        };
        // Default settings
        var settings = {
            /** Whether this instance should log debug messages. */
            debug: false,
            /** Whether or not the websocket should attempt to connect immediately upon instantiation. */
            automaticOpen: true,
            /** The number of milliseconds to delay before attempting to reconnect. */
            reconnectInterval: 1000,
            /** The maximum number of milliseconds to delay a reconnection attempt. */
            maxReconnectInterval: 30000,
            /** The rate of increase of the reconnect delay. Allows reconnect attempts to back off when problems persist. */
            reconnectDecay: 1.5,
            /** The maximum time in milliseconds to wait for a connection to succeed before closing and retrying. */
            timeoutInterval: 2000,
            /** The maximum number of reconnection attempts to make. Unlimited if null. */
            maxReconnectAttempts: null,
            /** The binary type, possible values 'blob' or 'arraybuffer', default 'blob'. */
            binaryType: 'blob'
        };
        if (!options) {
            this.options = {};
        }
        // Overwrite and define settings with options if they exist.
        for (var key in settings) {
            if (typeof options[key] === 'undefined') {
                options[key] = settings[key];
            }
        }
        if (this.options.automaticOpen == true) {
            this.open(false);
        }
        this.eventTarget.addEventListener('open', function (event) { return _this.onopen(event); });
        this.eventTarget.addEventListener('close', function (event) { return _this.onclose(event); });
        this.eventTarget.addEventListener('connecting', function (event) { return _this.onconnecting(event); });
        this.eventTarget.addEventListener('message', function (event) { return _this.onmessage(event); });
        this.eventTarget.addEventListener('error', function (event) { return _this.onerror(event); });
    }
    ReconnectingSockJS.prototype.generateEvent = function (s, args) {
        if (args === void 0) { args = null; }
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent(s, false, false, args);
        return evt;
    };
    ;
    ReconnectingSockJS.prototype.open = function (reconnectAttempt) {
        var _this = this;
        this.ws = new WebSocket(this.url, this.protocols || []);
        this.ws.binaryType = this.options.binaryType;
        if (reconnectAttempt) {
            if (this.options.maxReconnectAttempts && this.reconnectAttempts > this.options.maxReconnectAttempts) {
                return;
            }
        }
        else {
            this.eventTarget.dispatchEvent(this.generateEvent('connecting'));
            this.reconnectAttempts = 0;
        }
        if (this.options.debug || ReconnectingSockJS.debugAll) {
            console.debug('ReconnectingSockJS', 'attempt-connect', this.url);
        }
        var localWs = this.ws;
        var timeout = setTimeout(function () {
            if (_this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'connection-timeout', _this.url);
            }
            _this.timedOut = true;
            localWs.close();
            _this.timedOut = false;
        }, this.options.timeoutInterval);
        this.ws.onopen = function (event) {
            clearTimeout(timeout);
            if (_this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'onopen', _this.options.url);
            }
            _this.protocol = _this.ws.protocol;
            _this.readyState = WebSocket.OPEN;
            _this.reconnectAttempts = 0;
            var e = _this.generateEvent('open');
            e["isReconnect"] = reconnectAttempt;
            reconnectAttempt = false;
            _this.eventTarget.dispatchEvent(e);
        };
        this.ws.onclose = function (event) {
            clearTimeout(timeout);
            _this.ws = null;
            if (_this.forcedClose) {
                _this.readyState = WebSocket.CLOSED;
                _this.eventTarget.dispatchEvent(_this.generateEvent('close'));
            }
            else {
                _this.readyState = WebSocket.CONNECTING;
                var e = _this.generateEvent('connecting');
                e.code = event.code;
                e.reason = event.reason;
                e.wasClean = event.wasClean;
                _this.eventTarget.dispatchEvent(e);
                if (!reconnectAttempt && !_this.timedOut) {
                    if (_this.options.debug || ReconnectingSockJS.debugAll) {
                        console.debug('ReconnectingSockJS', 'onclose', _this.url);
                    }
                    _this.eventTarget.dispatchEvent(_this.generateEvent('close'));
                }
                var timeout = _this.options.reconnectInterval * Math.pow(_this.options.reconnectDecay, _this.reconnectAttempts);
                setTimeout(function () {
                    _this.reconnectAttempts++;
                    _this.open(true);
                }, timeout > _this.options.maxReconnectInterval ? _this.options.maxReconnectInterval : timeout);
            }
        };
        this.ws.onmessage = function (event) {
            if (_this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'onmessage', _this.url, event.data);
            }
            var e = _this.generateEvent('message');
            e.data = event.data;
            _this.eventTarget.dispatchEvent(e);
        };
        this.ws.onerror = function (event) {
            if (_this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'onerror', _this.url, event);
            }
            _this.eventTarget.dispatchEvent(_this.generateEvent('error'));
        };
    };
    ReconnectingSockJS.prototype.send = function (data) {
        if (this.ws) {
            if (this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'send', this.url, data);
            }
            return this.ws.send(data);
        }
        else {
            throw 'INVALID_STATE_ERR : Pausing to reconnect websocket';
        }
    };
    ;
    ReconnectingSockJS.prototype.close = function (code, reason) {
        // Default CLOSE_NORMAL code
        if (typeof code == 'undefined') {
            code = 1000;
        }
        this.forcedClose = true;
        if (this.ws) {
            this.ws.close(code, reason);
        }
    };
    ;
    ReconnectingSockJS.prototype.onerror = function (arg0) {
    };
    ReconnectingSockJS.prototype.onmessage = function (arg0) {
    };
    ReconnectingSockJS.prototype.onconnecting = function (arg0) {
    };
    ReconnectingSockJS.prototype.onclose = function (arg0) {
    };
    ReconnectingSockJS.prototype.onopen = function (arg0) {
    };
    ReconnectingSockJS.debugAll = false;
    ReconnectingSockJS.CONNECTING = WebSocket.CONNECTING;
    ReconnectingSockJS.OPEN = WebSocket.OPEN;
    ReconnectingSockJS.CLOSING = WebSocket.CLOSING;
    ReconnectingSockJS.CLOSED = WebSocket.CLOSED;
    return ReconnectingSockJS;
}());
