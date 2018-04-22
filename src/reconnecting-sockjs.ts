import * as SockJS from 'sockjs';

class ReconnectingSockJS {
    static debugAll = false;
    static CONNECTING = WebSocket.CONNECTING;
    static OPEN = WebSocket.OPEN;
    static CLOSING = WebSocket.CLOSING;
    static CLOSED = WebSocket.CLOSED;

    readyState = WebSocket.CONNECTING;
    reconnectAttempts = 0;
    protocol = null;

    private ws: SockJS;
    private forcedClose = false;
    private timedOut = false;

    private eventTarget = document.createElement('div');
    private addEventListener = this.eventTarget.addEventListener.bind(this.eventTarget);
    private removeEventListener = this.eventTarget.removeEventListener.bind(this.eventTarget);
    private dispatchEvent = this.eventTarget.dispatchEvent.bind(this.eventTarget);

    constructor(private url: string, private protocols, private options) {
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
        }
        if (!options) { this.options = {}; }

        // Overwrite and define settings with options if they exist.
        for (var key in settings) {
            if (typeof options[key] === 'undefined') {
                options[key] = settings[key];
            }
        }

        if (this.options.automaticOpen == true) {
            this.open(false);
        }

        this.eventTarget.addEventListener('open', (event) => this.onopen(event));
        this.eventTarget.addEventListener('close', (event) => this.onclose(event));
        this.eventTarget.addEventListener('connecting', (event) => this.onconnecting(event));
        this.eventTarget.addEventListener('message', (event) => this.onmessage(event));
        this.eventTarget.addEventListener('error', (event) => this.onerror(event));
    }
    generateEvent(s, args = null): any {
        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent(s, false, false, args);
        return evt;
    };
    open(reconnectAttempt) {
        this.ws = new WebSocket(this.url, this.protocols || []);
        this.ws.binaryType = this.options.binaryType;

        if (reconnectAttempt) {
            if (this.options.maxReconnectAttempts && this.reconnectAttempts > this.options.maxReconnectAttempts) {
                return;
            }
        } else {
            this.eventTarget.dispatchEvent(this.generateEvent('connecting'));
            this.reconnectAttempts = 0;
        }

        if (this.options.debug || ReconnectingSockJS.debugAll) {
            console.debug('ReconnectingSockJS', 'attempt-connect', this.url);
        }

        var localWs = this.ws;
        var timeout = setTimeout(() => {
            if (this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'connection-timeout', this.url);
            }
            this.timedOut = true;
            localWs.close();
            this.timedOut = false;
        }, this.options.timeoutInterval);

        this.ws.onopen = (event) => {
            clearTimeout(timeout);
            if (this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'onopen', this.options.url);
            }
            this.protocol = this.ws.protocol;
            this.readyState = WebSocket.OPEN;
            this.reconnectAttempts = 0;
            var e = this.generateEvent('open');
            e["isReconnect"] = reconnectAttempt;
            reconnectAttempt = false;
            this.eventTarget.dispatchEvent(e);
        };

        this.ws.onclose = (event) => {
            clearTimeout(timeout);
            this.ws = null;
            if (this.forcedClose) {
                this.readyState = WebSocket.CLOSED;
                this.eventTarget.dispatchEvent(this.generateEvent('close'));
            } else {
                this.readyState = WebSocket.CONNECTING;
                var e = this.generateEvent('connecting');
                e.code = event.code;
                e.reason = event.reason;
                e.wasClean = event.wasClean;
                this.eventTarget.dispatchEvent(e);
                if (!reconnectAttempt && !this.timedOut) {
                    if (this.options.debug || ReconnectingSockJS.debugAll) {
                        console.debug('ReconnectingSockJS', 'onclose', this.url);
                    }
                    this.eventTarget.dispatchEvent(this.generateEvent('close'));
                }

                var timeout = this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempts);
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.open(true);
                }, timeout > this.options.maxReconnectInterval ? this.options.maxReconnectInterval : timeout);
            }
        };
        this.ws.onmessage = (event) => {
            if (this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'onmessage', this.url, event.data);
            }
            var e = this.generateEvent('message');
            e.data = event.data;
            this.eventTarget.dispatchEvent(e);
        };
        this.ws.onerror = (event) => {
            if (this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'onerror', this.url, event);
            }
            this.eventTarget.dispatchEvent(this.generateEvent('error'));
        };
    }
    send(data) {
        if (this.ws) {
            if (this.options.debug || ReconnectingSockJS.debugAll) {
                console.debug('ReconnectingSockJS', 'send', this.url, data);
            }
            return this.ws.send(data);
        } else {
            throw 'INVALID_STATE_ERR : Pausing to reconnect websocket';
        }
    };

    close(code, reason) {
        // Default CLOSE_NORMAL code
        if (typeof code == 'undefined') {
            code = 1000;
        }
        this.forcedClose = true;
        if (this.ws) {
            this.ws.close(code, reason);
        }
    };

    refresh = function () {
        if (this.ws) {
            this.ws.close();
        }
    };
    onerror(arg0: any): any {
    }
    onmessage(arg0: any): any {
    }
    onconnecting(arg0: any): any {
    }
    onclose(arg0: any): any {
    }
    onopen(arg0: any): any {
    }
}