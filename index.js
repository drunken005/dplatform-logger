const fs           = require("fs");
const log4js       = require("log4js");
const _            = require("lodash");
const createConfig = require("./config");
const path         = require("path");


let imp         = {};
const mkdirSync = function (logDir) {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, 0o777);
    }
};
const toKeyVal  = function (key, val) {
    let willVal = key;
    if (_.isArray(val) || _.isObject(val)) {
        willVal += `=${JSON.stringify(val)}`;
    } else if (!_.isUndefined(val) && !_.isNull(val)) {
        willVal += `=${_.toString(val)}`;
    }
    return willVal;
};
const formatMsg = function (...args) {
    let _args = args;
    try {
        if (args.length === 2) {
            let val = toKeyVal(args[0], args[1]);
            _args   = [val];
        } else if (args.length === 1) {
            let val  = args[0];
            let vals = "";
            if (_.isArray(val)) {
                for (let i = 0; i + 1 < val.length; i += 2) {
                    vals += `||${toKeyVal(val[i], val[i + 1])}`;
                }
            } else if (_.isObject(val)) {
                for (let [k, v] of Object.entries(val)) {
                    vals += `||${toKeyVal(k, v)}`;
                }
            }
            if (vals && vals.length > 2) {
                vals  = vals.substring(2);
                _args = [vals];
            }
        }
    } catch (err) {
        imp.access.error(err);
        _args = args;
    }
    return _args;
};

const initImp = (logger) => {
    imp.access       = logger || log4js.getLogger("access");
    imp.errors       = logger || log4js.getLogger("errors");
    imp.transactions = logger || log4js.getLogger("transaction");
    imp.alarms       = logger || log4js.getLogger("alarm");
    imp.debug        = (...args) => {
        let _args = formatMsg(...args);
        imp.access.debug.apply(imp.access, _args);
    };
    imp.info         = (...args) => {
        let _args = formatMsg(...args);
        imp.access.info.apply(imp.access, _args);
    };
    imp.warn         = (...args) => {
        imp.access.warn.apply(imp.access, args);
    };
    imp.error        = (...args) => {
        let _args = formatMsg(...args);
        imp.access.error.apply(imp.access, _args);
        imp.errors.error.apply(imp.errors, _args);
        imp.alarms.info.apply(imp.alarms, _args);
    };
    imp.stack        = (...args) => {
        let err     = args[0];
        let errInfo = {
            reqid:   err && err.reqid ? err.reqid : "",
            code:    err && err.respCode ? err.respCode : "",
            message: err && err.message ? err.message : "",
            stack:   err && err.stack ? err.stack : "",
        };
        let _args   = formatMsg(errInfo);
        imp.access.warn.apply(imp.access, _args);
        imp.errors.warn.apply(imp.errors, _args);
        imp.alarms.info.apply(imp.alarms, _args);
    };
    imp.transaction  = (...args) => {
        let _args = formatMsg(...args);
        imp.transactions.info.apply(imp.transactions, _args);
    };
    imp.sql          = (sql, cost) => {
        let SQL = `${sql}||cost=${cost}ms`;
        imp.transaction({SQL});
    };
    imp.in           = (msg) => {
        let _msg = formatMsg(msg);
        imp.access.info(`${"+".repeat(20)}=${_msg}`);
    };
    imp.out          = (msg) => {
        let _msg = formatMsg(msg);
        imp.access.info(`${"-".repeat(20)}=${_msg}`);
    };
    imp.alarm        = (msg) => {
        let _msg = formatMsg(msg);
        imp.alarms.info(`${_msg}`);
        imp.access.warn.apply(imp.access, _msg);
    };
};

const _logOptions = (serviceName) => {
    serviceName = serviceName || "";
    return {
        logDir:        path.join(path.resolve("."), "log", serviceName),
        monitorLogDir: path.join(path.resolve("."), "log"),
        numBackups:    5,
        serviceName:   serviceName || "alarm",
    };
};

const logger = (serviceName) => {
    if (!imp.alarms) {
        const options = _logOptions(serviceName);
        mkdirSync(options.monitorLogDir);
    }
    if (!imp.access) {
        const options = _logOptions(serviceName);
        mkdirSync(options.logDir);
        log4js.configure(createConfig(options));
        initImp(options.customizedLogger);
        imp = _.assign({}, imp, options);
    }
    return imp;
};

module.exports = logger;