/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/ts/background.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/ts/ManageFollowing.ts":
/*!***********************************!*\
  !*** ./src/ts/ManageFollowing.ts ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

// 这是一个后台脚本
class ManageFollowing {
    constructor() {
        this.store = 'following';
        this.data = [];
        /**当状态为 locked 时，如果需要增加或删除某个关注的用户，则将其放入等待队列 */
        this.queue = [];
        this.status = 'idle';
        this.updateTaskTabID = 0;
        this.restore();
        chrome.runtime.onInstalled.addListener(async () => {
            // 每次更新或刷新扩展时尝试读取数据，如果数据不存在则设置数据
            const data = await chrome.storage.local.get(this.store);
            if (data[this.store] === undefined ||
                Array.isArray(data[this.store]) === false) {
                this.storage();
            }
        });
        chrome.runtime.onMessage.addListener(async (msg, sender) => {
            if (msg.msg === 'requestFollowingData') {
                this.dispath(sender === null || sender === void 0 ? void 0 : sender.tab);
            }
            if (msg.msg === 'needUpdateFollowingData') {
                if (this.status === 'locked') {
                    // 查询上次执行更新任务的标签页还是否存在，如果不存在，
                    // 则改为让这次发起请求的标签页执行更新任务
                    const tabs = await this.findAllPixivTab();
                    const find = tabs.find((tab) => tab.id === this.updateTaskTabID);
                    if (!find) {
                        this.updateTaskTabID = sender.tab.id;
                    }
                    else {
                        // 如果上次执行更新任务的标签页依然存在，且状态锁定，则拒绝这次请求
                        return;
                    }
                }
                else {
                    this.updateTaskTabID = sender.tab.id;
                }
                this.status = 'locked';
                chrome.tabs.sendMessage(this.updateTaskTabID, {
                    msg: 'updateFollowingData',
                });
            }
            if (msg.msg === 'setFollowingData') {
                const data = msg.data;
                // 当前台获取新的关注列表完成之后，会发送此消息。
                // 如果发送消息的页面和发起请求的页面是同一个，则解除锁定状态
                if (sender.tab.id === this.updateTaskTabID) {
                    // set 操作不会被放入等待队列中，而且总是会被立即执行
                    // 这是因为在请求数据的过程中可能产生了其他操作，set 操作的数据可能已经是旧的了
                    // 所以需要先应用 set 里的数据，然后再执行其他操作，在旧数据的基础上进行修改
                    this.setData(data);
                    // 如果队列中没有等待的操作，则立即派发数据并储存数据
                    // 如果有等待的操作，则不派发和储存数据，因为稍后队列执行完毕后也会派发和储存数据
                    // 这是为了避免重复派发和储存数据，避免影响性能
                    if (this.queue.length === 0) {
                        this.dispath();
                        this.storage();
                    }
                    this.status = 'idle';
                    return;
                }
                // 如果不是同一个页面，这个 set 操作会被丢弃
            }
        });
        // 监听用户新增或取消一个关注的请求
        // 由于某些逻辑相似，就添加到一个监听器里了
        chrome.webRequest.onBeforeRequest.addListener((details) => {
            var _a;
            if (details.method === 'POST') {
                if ((_a = details === null || details === void 0 ? void 0 : details.requestBody) === null || _a === void 0 ? void 0 : _a.formData) {
                    let operate = {
                        action: '',
                        loggedUserID: '',
                        userID: '',
                    };
                    // 检查数据格式是否是自己需要的，以防这个 URL 有其他用途
                    const formData = details.requestBody.formData;
                    if (details.url.endsWith('bookmark_add.php')) {
                        const check = formData.mode &&
                            formData.mode[0] === 'add' &&
                            formData.user_id &&
                            formData.user_id[0];
                        if (check) {
                            operate.action = 'add';
                            operate.userID = formData.user_id[0];
                        }
                        else {
                            return;
                        }
                    }
                    if (details.url.endsWith('rpc_group_setting.php')) {
                        const check = formData.mode &&
                            formData.mode[0] === 'del' &&
                            formData.type &&
                            formData.type[0] === 'bookuser' &&
                            formData.id &&
                            formData.id[0];
                        if (check) {
                            operate.action = 'remove';
                            operate.userID = formData.id[0];
                        }
                        else {
                            return;
                        }
                    }
                    // 获取发起请求的标签页里的登录的用户 ID
                    chrome.tabs.sendMessage(details.tabId, {
                        msg: 'getLoggedUserID',
                    }, (response) => {
                        if (response === null || response === void 0 ? void 0 : response.loggedUserID) {
                            operate.loggedUserID = response.loggedUserID;
                            this.queue.push(operate);
                            this.executionQueue();
                        }
                    });
                }
            }
        }, {
            urls: [
                'https://*.pixiv.net/bookmark_add.php',
                'https://*.pixiv.net/rpc_group_setting.php',
            ],
            types: ['xmlhttprequest'],
        }, ['requestBody']);
        setInterval(() => {
            this.executionQueue();
        }, 1000);
        this.checkDeadlock();
        this.clearUnusedData();
    }
    async restore() {
        if (this.status !== 'idle') {
            return;
        }
        this.status = 'loading';
        const data = await chrome.storage.local.get(this.store);
        if (data[this.store] && Array.isArray(data[this.store])) {
            this.data = data[this.store];
            this.status = 'idle';
        }
        else {
            return setTimeout(() => {
                this.restore();
            }, 500);
        }
    }
    /**向前台脚本派发数据
     * 可以指定向哪个 tab 派发
     * 如果未指定 tab，则向所有的 pixiv 标签页派发
     */
    async dispath(tab) {
        if (tab === null || tab === void 0 ? void 0 : tab.id) {
            chrome.tabs.sendMessage(tab.id, {
                msg: 'dispathFollowingData',
                data: this.data,
            });
        }
        else {
            const tabs = await this.findAllPixivTab();
            for (const tab of tabs) {
                chrome.tabs.sendMessage(tab.id, {
                    msg: 'dispathFollowingData',
                    data: this.data,
                });
            }
        }
    }
    storage() {
        return chrome.storage.local.set({ following: this.data });
    }
    /**执行队列中的所有操作 */
    executionQueue() {
        if (this.status !== 'idle' || this.queue.length === 0) {
            return;
        }
        while (this.queue.length > 0) {
            // set 操作不会在此处执行
            const queue = this.queue.shift();
            this.addOrRemoveOne(queue);
        }
        // 队列中的所有操作完成后，派发和储存数据
        this.dispath();
        this.storage();
    }
    setData(data) {
        const index = this.data.findIndex((following) => following.user === data.user);
        if (index > -1) {
            this.data[index].following = data.following;
            this.data[index].total = data.total;
            this.data[index].time = new Date().getTime();
        }
        else {
            this.data.push({
                user: data.user,
                following: data.following,
                total: data.total,
                time: new Date().getTime(),
            });
        }
    }
    addOrRemoveOne(operate) {
        const i = this.data.findIndex((following) => following.user === operate.loggedUserID);
        if (i === -1) {
            return;
        }
        if (operate.action === 'add') {
            this.data[i].following.push(operate.userID);
            this.data[i].total = this.data[i].total + 1;
        }
        else if (operate.action === 'remove') {
            const index = this.data[i].following.findIndex((id) => id === operate.userID);
            if (index > -1) {
                this.data[i].following.splice(index, 1);
                this.data[i].total = this.data[i].total - 1;
            }
        }
        else {
            return;
        }
        this.data[i].time = new Date().getTime();
    }
    async findAllPixivTab() {
        const tabs = await chrome.tabs.query({
            url: 'https://*.pixiv.net/*',
        });
        return tabs;
    }
    /**解除死锁
     * 一个标签页在执行更新任务时可能会被用户关闭，这会导致锁死
     * 定时检查执行更新任务的标签页是否还存在，如果不存在则解除死锁
     */
    checkDeadlock() {
        setInterval(async () => {
            if (this.status === 'locked') {
                const tabs = await this.findAllPixivTab();
                const find = tabs.find((tab) => tab.id === this.updateTaskTabID);
                if (!find) {
                    this.status = 'idle';
                }
            }
        }, 30000);
    }
    /**如果某个用户的关注数据 30 天没有修改过，则清除对应的数据 */
    clearUnusedData() {
        setInterval(() => {
            const day30ms = 2592000000;
            for (let index = 0; index < this.data.length; index++) {
                const item = this.data[index];
                if (new Date().getTime() - item.time > day30ms) {
                    this.data.splice(index, 1);
                    this.dispath();
                    this.storage();
                    break;
                }
            }
        }, 3600000);
    }
}
new ManageFollowing();


/***/ }),

/***/ "./src/ts/background.ts":
/*!******************************!*\
  !*** ./src/ts/background.ts ***!
  \******************************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _ManageFollowing__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ManageFollowing */ "./src/ts/ManageFollowing.ts");
/* harmony import */ var _ManageFollowing__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_ManageFollowing__WEBPACK_IMPORTED_MODULE_0__);

// 隐藏或显示浏览器底部的下载栏
chrome.runtime.onMessage.addListener((data, sender) => {
    if (data.msg === 'setShelfEnabled') {
        chrome.downloads.setShelfEnabled(data.value);
    }
});
// 当点击扩展图标时，显示/隐藏下载面板
chrome.action.onClicked.addListener(function (tab) {
    // 在本程序没有权限的页面上点击扩展图标时，url 始终是 undefined，此时不发送消息
    if (!tab.url) {
        return;
    }
    chrome.tabs.sendMessage(tab.id, {
        msg: 'click_icon',
    });
});
// 当扩展被安装、被更新、或者浏览器升级时，初始化数据
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ batchNo: {}, idList: {} });
});
// 存储每个下载任务的数据，这是因为下载完成的顺序和前台发送的顺序可能不一致，所以需要把数据保存起来以供使用
const dlData = {};
// 使用每个页面的 tabId 作为索引，储存此页面里当前下载任务的编号。用来判断不同批次的下载
let batchNo = {};
// 使用每个页面的 tabId 作为索引，储存此页面里所发送的下载请求的作品 id 列表，用来判断重复的任务
let idList = {};
// batchNo 和 idList 需要持久化存储（但是当浏览器关闭并重新启动时可以清空，因为此时前台的下载任务必然和浏览器关闭之前的不是同一批了，所以旧的数据已经没用了）
// 如果不进行持久化存储，如果前台任务处于下载途中，后台 SW 被回收了，那么变量也会被清除。之后前台传递过来的可能还是同一批下载里的任务，但是后台却丢失了记录。这可能会导致下载出现重复文件等异常。
// 实际上，下载时后台 SW 会持续存在很长时间，不会轻易被回收的。持久化存储只是为了以防万一
// 封装 chrome.storage.local.set。不需要等待回调
async function setData(data) {
    return chrome.storage.local.set(data);
}
chrome.runtime.onMessage.addListener(async function (msg, sender) {
    var _a;
    // save_work_file 下载作品的文件
    if (msg.msg === 'save_work_file') {
        // 当处于初始状态时，或者变量被回收了，就从存储中读取数据储存在变量中
        // 之后每当要使用这两个数据时，从变量读取，而不是从存储中获得。这样就解决了数据不同步的问题，而且性能更高
        if (Object.keys(batchNo).length === 0) {
            const data = await chrome.storage.local.get(['batchNo', 'idList']);
            batchNo = data.batchNo;
            idList = data.idList;
        }
        const tabId = sender.tab.id;
        // 如果开始了新一批的下载，重设批次编号，并清空下载索引
        if (batchNo[tabId] !== msg.taskBatch) {
            batchNo[tabId] = msg.taskBatch;
            idList[tabId] = [];
            setData({ batchNo, idList });
            // 这里存储数据时不需要使用 await，因为后面使用的是全局变量，所以不需要关心存储数据的同步问题
        }
        // 检查任务是否重复，不重复则下载
        if (!idList[tabId].includes(msg.id)) {
            // 储存该任务的索引
            idList[tabId].push(msg.id);
            setData({ idList });
            // 开始下载
            chrome.downloads.download({
                url: msg.fileUrl,
                filename: msg.fileName,
                conflictAction: 'overwrite',
                saveAs: false,
            }, (id) => {
                // id 是 Chrome 新建立的下载任务的 id
                // 使用下载任务的 id 作为 key 保存数据
                const data = {
                    url: msg.fileUrl,
                    id: msg.id,
                    tabId: tabId,
                    uuid: false,
                };
                dlData[id] = data;
            });
        }
    }
    // save_description_file 下载作品的简介文件，不需要返回下载状态
    // save_novel_cover_file 下载小说的封面图片
    if (msg.msg === 'save_description_file' ||
        msg.msg === 'save_novel_cover_file' ||
        msg.msg === 'save_novel_embedded_image') {
        chrome.downloads.download({
            url: msg.fileUrl,
            filename: msg.fileName,
            conflictAction: 'overwrite',
            saveAs: false,
        });
    }
    if (msg.msg === 'clearDownloadsTempData') {
        if ((_a = sender.tab) === null || _a === void 0 ? void 0 : _a.id) {
            const tabId = sender.tab.id;
            delete idList[tabId];
            delete batchNo[tabId];
            setData({ batchNo, idList });
        }
    }
});
// 判断文件名是否变成了 UUID 格式。因为文件名处于整个绝对路径的中间，所以没加首尾标记 ^ $
const UUIDRegexp = /[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}/;
// 监听下载变化事件
// 每个下载会触发两次 onChanged 事件
chrome.downloads.onChanged.addListener(async function (detail) {
    // 根据 detail.id 取出保存的数据
    const data = dlData[detail.id];
    if (data) {
        let msg = '';
        let err = '';
        // 判断当前文件名是否正常。下载时必定会有一次 detail.filename.current 有值
        if (detail.filename && detail.filename.current) {
            const changedName = detail.filename.current;
            if (changedName.match(UUIDRegexp) !== null) {
                // 文件名是 UUID
                data.uuid = true;
            }
        }
        if (detail.state && detail.state.current === 'complete') {
            msg = 'downloaded';
        }
        if (detail.error && detail.error.current) {
            msg = 'download_err';
            err = detail.error.current;
            // 当保存一个文件出错时，从任务记录列表里删除它，以便前台重试下载
            const idIndex = idList[data.tabId].findIndex((val) => val === data.id);
            idList[data.tabId][idIndex] = '';
            setData({ idList });
        }
        // 返回信息
        if (msg) {
            chrome.tabs.sendMessage(data.tabId, { msg, data, err });
            // 清除这个任务的数据
            dlData[detail.id] = null;
        }
    }
});
// 清除不需要的数据，避免数据体积越来越大
async function clearData() {
    for (const key of Object.keys(idList)) {
        const tabId = parseInt(key);
        try {
            await chrome.tabs.get(tabId);
        }
        catch (error) {
            // 如果建立下载任务的标签页已经不存在，则会触发错误，如：
            // Unchecked runtime.lastError: No tab with id: 1943988409.
            // 此时删除对应的数据
            delete idList[tabId];
            delete batchNo[tabId];
        }
    }
    setData({ batchNo, idList });
}
setInterval(() => {
    clearData();
}, 60000);


/***/ })

/******/ });
//# sourceMappingURL=background.js.map