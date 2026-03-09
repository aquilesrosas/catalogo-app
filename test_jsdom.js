const { JSDOM, VirtualConsole } = require('jsdom');

(async () => {
    const virtualConsole = new VirtualConsole();
    virtualConsole.sendTo(console);
    virtualConsole.on("jsdomError", (error) => {
        console.error("JSDOM SCRIPT ERROR:", error);
    });

    try {
        const dom = await JSDOM.fromFile('./dist/index.html', {
            resources: "usable",
            runScripts: "dangerously",
            virtualConsole
        });
        console.log("Waiting for JS to execute...");
        await new Promise(r => setTimeout(r, 3000));
        console.log("Done waiting.");
    } catch (e) {
        console.error("LOAD ERROR:", e);
    }
})();
