self.importScripts("../common/highlight.pack.js");

self.onmessage = function(event) {
    try {
        self.postMessage(self.hljs.highlight(event.data.language, event.data.code).value + "<div style=\"padding-bottom: 1em;\"></div>");
    }
    catch (err) {

    }
}
