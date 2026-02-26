const { execSync } = require("child_process");
const AnyProxy = require("anyproxy");

const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 10086;
const REG_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";

function regQuery(valueName) {
    try {
        const out = execSync(`reg.exe query "${REG_KEY}" /v ${valueName}`, { encoding: "utf8" });
        const match = out.match(/REG_\w+\s+(\S+)/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

function regSet(valueName, type, value) {
    execSync(`reg.exe add "${REG_KEY}" /v ${valueName} /t ${type} /d "${value}" /f`);
}

// 启动前保存当前系统代理状态
const originalEnable = regQuery("ProxyEnable");
const originalServer = regQuery("ProxyServer");

function enableProxy() {
    regSet("ProxyServer", "REG_SZ", `${PROXY_HOST}:${PROXY_PORT}`);
    regSet("ProxyEnable", "REG_DWORD", "1");
    console.log(`[proxy] 系统代理已设置为 ${PROXY_HOST}:${PROXY_PORT}`);
}

function restoreProxy() {
    try {
        const prevEnable = originalEnable === "0x1" ? "1" : "0";
        regSet("ProxyEnable", "REG_DWORD", prevEnable);
        if (originalServer) {
            regSet("ProxyServer", "REG_SZ", originalServer);
        }
        console.log("[proxy] 系统代理已恢复");
    } catch (e) {
        console.error("[proxy] 恢复系统代理失败:", e.message);
    }
}

function shutdown() {
    restoreProxy();
    proxyServer.close();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (e) => {
    console.error(e);
    restoreProxy();
    process.exit(1);
});

const options = {
    port: PROXY_PORT,
    rule: require("./rules"),
    webInterface: {
        enable: true,
        webPort: 8002
    },
    throttle: 10000,
    forceProxyHttps: true,
    wsIntercept: false,
    silent: false
};

const proxyServer = new AnyProxy.ProxyServer(options);

proxyServer.on("ready", () => {
    enableProxy();
});

proxyServer.on("error", (e) => {
    console.error(e);
});

proxyServer.start();
