// ==UserScript==
// @name:zh-CN   动漫花园评论区屏蔽助手
// @name         DMHY Comment Block
// @namespace    https://github.com/xkbkx5904/dmhy-comment-block
// @version      1.0.4
// @description:zh-CN  屏蔽动漫花园评论区的用户和关键词
// @description  Block users and keywords in dmhy comment section
// @author       xkbkx5904
// @license      MIT
// @language     zh-CN
// @match        *://share.dmhy.org/topics/view/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @noframes
// @supportURL   https://github.com/xkbkx5904/dmhy-comment-block/issues
// @homepageURL  https://github.com/xkbkx5904/dmhy-comment-block
// @updateURL    https://raw.githubusercontent.com/xkbkx5904/dmhy-comment-block/main/dmhy_comment_block.user.js
// @downloadURL  https://raw.githubusercontent.com/xkbkx5904/dmhy-comment-block/main/dmhy_comment_block.user.js
// @icon         https://share.dmhy.org/favicon.ico
// @compatible   chrome
// @compatible   firefox
// @compatible   edge
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// ==/UserScript==

// 用户黑名单列表
let UserBlockList = [];

// 从本地存储加载黑名单
function loadBlockList() {
    try {
        const saved = GM_getValue('dmhy_comment_blocklist', []);
        UserBlockList = Array.isArray(saved) ? saved.map(item => {
            if (item.type === 'keywords') {
                return {
                    type: 'keywords',
                    values: item.values.map(k => {
                        if (typeof k === 'string' && k.startsWith('/') && k.endsWith('/')) {
                            try {
                                return new RegExp(k.slice(1, -1));
                            } catch (e) {
                                return k;
                            }
                        }
                        return k;
                    })
                };
            }
            return item;
        }) : [];
    } catch (err) {
        UserBlockList = [];
    }
}

// 保存黑名单到本地存储
function saveBlockList() {
    try {
        const listToSave = UserBlockList.map(item => {
            if (item.type === 'keywords') {
                return {
                    type: 'keywords',
                    values: item.values.map(k => {
                        if (k instanceof RegExp) {
                            return `/${k.source}/`;
                        }
                        return k;
                    })
                };
            }
            return item;
        });
        GM_setValue('dmhy_comment_blocklist', listToSave);
    } catch (err) {
        console.error('保存黑名单失败:', err);
    }
}

// 缓存常用的 DOM 选择器结果
const SELECTORS = {
    COMMENT_TABLE: '#comment_recent',
    COMMENT_ROW: 'tr[id^="comment"]',
    USERNAME: '.username',
    CONTENT: '.comment_con span:last-child'
};

// 优化处理评论的函数
function handleComments() {
    const comments = document.querySelectorAll(SELECTORS.COMMENT_ROW);
    if (!comments.length) return;

    // 预先获取黑名单数据，避免重复查找
    const userList = UserBlockList.find(item => item.type === 'users')?.values || [];
    const blockedKeywords = UserBlockList.find(item => item.type === 'keywords')?.values || [];

    comments.forEach(comment => {
        try {
            const commentId = comment.id.replace('comment', '');
            const usernameEl = comment.querySelector(SELECTORS.USERNAME);
            if (!usernameEl) return;

            const username = usernameEl.textContent.trim();
            const content = comment.querySelector(SELECTORS.CONTENT)?.textContent?.trim() || '';

            // 处理用户名链接（如果还没有处理过）
            if (!usernameEl.querySelector('a')) {
                const userLink = document.createElement('a');
                userLink.href = `/topics/list?keyword=${encodeURIComponent(username)}`;
                userLink.className = 'user-link';
                userLink.style.cssText = 'color:blue;text-decoration:underline;cursor:pointer;';
                userLink.textContent = username;
                
                userLink.onclick = (e) => {
                    e.preventDefault();
                    window.open(userLink.href, '_blank');
                };

                userLink.oncontextmenu = (e) => {
                    e.preventDefault();
                    showContextMenu(e, commentId);
                    return false;
                };

                usernameEl.innerHTML = '';
                usernameEl.appendChild(userLink);
            }

            // 检查是否需要屏蔽
            if (shouldBlockComment(username, content, commentId, userList, blockedKeywords)) {
                comment.style.display = 'none';
            }
        } catch (err) {
            console.error('Error processing comment:', err);
        }
    });
}

// 优化屏蔽判断函数
function shouldBlockComment(username, content, commentId, userList, blockedKeywords) {
    if (!username) return false;

    // 检查用户名和ID
    const isBlocked = userList.some(user => {
        // 如果匹配到用户名但没有ID，自动绑定ID
        if (user.username === username && !user.userId && commentId) {
            user.userId = parseInt(commentId);
            saveBlockList();  // 保存更新后的黑名单
        }
        // 通过用户名或ID匹配
        return user.username === username || (user.userId && user.userId === parseInt(commentId));
    });

    if (isBlocked) return true;

    // 检查关键词
    if (content && blockedKeywords.length) {
        return blockedKeywords.some(keyword => {
            if (typeof keyword === 'string') {
                return content.toLowerCase().includes(keyword.toLowerCase());
            }
            return keyword instanceof RegExp && keyword.test(content);
        });
    }

    return false;
}

// 修改显示上下文菜单的函数
function showContextMenu(event, commentId) {
    const menu = document.getElementById('dmhy-comment-context-menu');
    if (!menu) return;

    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.display = 'block';
    
    const username = event.target.textContent;
    
    const blockUserOption = document.getElementById('block-comment-user');
    if (blockUserOption) {
        blockUserOption.onclick = function(e) {
            e.stopPropagation();
            addUserToBlocklist(commentId, username);
            menu.style.display = 'none';
        };
    }

    // 改进关闭菜单的逻辑
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('scroll', closeMenu);
        }
    };

    // 添加滚动时关闭菜单
    window.addEventListener('scroll', closeMenu, { once: true });
    
    // 延迟添加点击监听器，避免立即触发
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

// 添加一个初始化后的检查
function checkAndRetryHandleComments() {
    console.log('Checking comments...');  // 添加调试日志
    const comments = document.querySelectorAll('#comment_list .comment-item');
    if (comments.length > 0) {
        console.log('Found comments, processing...');  // 添加调试日志
        handleComments();
    }
}

// 添加管理界面
function addBlocklistUI() {
    // 添加重试机制来检查主UI
    const maxAttempts = 5;
    let attempts = 0;

    function checkAndAddUI() {
        const mainBlocklistUI = document.getElementById('dmhy-blocklist-ui');
        
        if (mainBlocklistUI) {
            const mainButton = mainBlocklistUI.querySelector('button');
            if (mainButton) {
                mainButton.textContent = '管理种子黑名单';
            }
            
            // 检查是否已存在评论黑名单按钮
            if (!document.getElementById('show-comment-blocklist')) {
                const button = document.createElement('button');
                button.id = 'show-comment-blocklist';
                button.textContent = '管理评论黑名单';
                button.style.marginTop = '5px';
                button.style.display = 'block';
                mainBlocklistUI.appendChild(button);
                button.addEventListener('click', showBlocklistManager);
            }
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                // 如果还没找到主UI，继续尝试
                setTimeout(checkAndAddUI, 200);
            } else {
                // 超过最大尝试次数，创建独立UI
                const uiHtml = `
                    <div id="dmhy-comment-blocklist-ui" style="position:fixed;left:10px;top:10px;z-index:9999;">
                        <button id="show-comment-blocklist">管理评论黑名单</button>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', uiHtml);
                document.getElementById('show-comment-blocklist')?.addEventListener('click', showBlocklistManager);
            }
        }
    }

    // 开始检查
    checkAndAddUI();
}

// 修改显示黑名单管理界面的函数
function showBlocklistManager() {
    // 如果已存在管理界面，先移除
    const existingManager = document.getElementById('comment-blocklist-manager');
    const existingOverlay = document.getElementById('comment-blocklist-overlay');
    if (existingManager) existingManager.remove();
    if (existingOverlay) existingOverlay.remove();

    const managerHtml = `
        <div id="comment-blocklist-manager" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
            background:white;padding:20px;border:1px solid #ccc;border-radius:5px;z-index:10000;
            width:500px;max-height:80vh;overflow-y:auto;">
            <h3 style="margin-top:0;">评论区黑名单管理</h3>
            <div style="margin-bottom:10px;">
                <label>用户黑名单（注意是用户名，用分号分隔）：</label><br>
                <textarea id="blocked-usernames" style="width:100%;height:60px;margin-top:5px;resize:none;"></textarea>
            </div>
            <div style="margin-bottom:10px;">
                <label>关键词屏蔽（用分号分隔）：</label><br>
                <textarea id="comment-keywords" style="width:100%;height:60px;margin-top:5px;resize:none;"></textarea>
                <div style="color:#666;font-size:12px;margin-top:5px;">
                    提示：支持普通文本和正则表达式<br>
                    - 普通文本直接输入，用分号分隔<br>
                    - 正则表达式用 / 包裹，例如：/\\d+/<br>
                    - 示例：文本1；/user\\d+/；文本2
                </div>
            </div>
            <div style="margin-top:10px;text-align:right;">
                <button id="save-comment-blocklist">保存</button>
                <button id="close-comment-manager">关闭</button>
            </div>
        </div>
        <div id="comment-blocklist-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;
            background:rgba(0,0,0,0.5);z-index:9999;"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', managerHtml);

    // 填充现有数据
    const userList = UserBlockList.find(item => item.type === 'users')?.values || [];
    const keywords = UserBlockList.find(item => item.type === 'keywords')?.values || [];

    // 填充用户名
    document.getElementById('blocked-usernames').value = userList
        .map(user => user.username)
        .filter(username => username) // 过滤掉空值
        .join('；');

    // 填充关键词
    document.getElementById('comment-keywords').value = keywords.map(k => {
        if (k instanceof RegExp) {
            return `/${k.source}/`;
        }
        return k;
    }).join('；');

    // 绑定关闭按钮事件
    document.getElementById('close-comment-manager').addEventListener('click', function() {
        document.getElementById('comment-blocklist-manager')?.remove();
        document.getElementById('comment-blocklist-overlay')?.remove();
    });

    // 绑定遮罩层点击事件
    document.getElementById('comment-blocklist-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
            document.getElementById('comment-blocklist-manager')?.remove();
            document.getElementById('comment-blocklist-overlay')?.remove();
        }
    });

    // 绑定保存按钮事件
    document.getElementById('save-comment-blocklist').addEventListener('click', function() {
        // 处理用户名
        const usernames = document.getElementById('blocked-usernames').value
            .split(/[;；]/)
            .map(name => name.trim())
            .filter(name => name);

        // 更新用户列表
        let userList = UserBlockList.find(item => item.type === 'users');
        if (!userList) {
            userList = { type: 'users', values: [] };
            UserBlockList.push(userList);
        }

        // 保留现有用户的ID信息
        const existingUsers = new Map(userList.values.map(user => [user.username, user.userId]));
        
        // 更新用户列表，保留已有ID并尝试查找新用户的ID
        userList.values = usernames.map(username => {
            const existingId = existingUsers.get(username);
            if (existingId) {
                // 如果已有ID，保留它
                return { username, userId: existingId };
            } else {
                // 尝试查找新用户的ID
                const newId = findUserIdByUsername(username);
                return { username, userId: newId ? parseInt(newId) : null };
            }
        });

        // 处理关键词
        const keywords = document.getElementById('comment-keywords').value
            .split(/[;；]/)
            .map(k => k.trim())
            .filter(k => k);

        // 更新关键词
        let keywordItem = UserBlockList.find(item => item.type === 'keywords');
        if (!keywordItem) {
            keywordItem = { type: 'keywords', values: [] };
            UserBlockList.push(keywordItem);
        }
        keywordItem.values = keywords;

        saveBlockList();
        document.getElementById('comment-blocklist-manager')?.remove();
        document.getElementById('comment-blocklist-overlay')?.remove();
        handleComments();
        showNotification('黑名单已更新');
    });
}

// 修改右键菜单的样式
function addContextMenu() {
    const menuHtml = `
        <div id="dmhy-comment-context-menu" style="
            display: none;
            position: fixed;
            background: white;
            border: 1px solid #ccc;
            border-radius: 3px;
            padding: 5px;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 150px;
        ">
            <div id="block-comment-user" style="
                padding: 8px 12px;
                cursor: pointer;
                white-space: nowrap;
            ">
                添加评论用户到黑名单
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

    // 添加悬停效果
    const blockUserOption = document.getElementById('block-comment-user');
    if (blockUserOption) {
        blockUserOption.addEventListener('mouseover', () => {
            blockUserOption.style.backgroundColor = '#f0f0f0';
        });
        blockUserOption.addEventListener('mouseout', () => {
            blockUserOption.style.backgroundColor = '';
        });
    }
}

// 添加通知提示函数
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 10001;
        font-size: 14px;
        transition: opacity 0.3s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // 2秒后自动消失
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 修改添加用户到黑名单的函数
function addUserToBlocklist(commentId, username) {
    if (!username) return;
    
    // 查找或创建用户列表
    let userList = UserBlockList.find(item => item.type === 'users');
    if (!userList) {
        userList = { type: 'users', values: [] };
        UserBlockList.push(userList);
    }

    // 检查是否已存在
    const existingUser = userList.values.find(u => u.username === username);
    if (existingUser) {
        // 如果存在且没有ID，则更新ID
        if (!existingUser.userId && commentId) {
            existingUser.userId = parseInt(commentId);
            showNotification(`已更新用户 ${username} 的ID信息`);
        }
    } else {
        // 添加新用户，包含ID（如果有）
        userList.values.push({
            username,
            userId: commentId ? parseInt(commentId) : null
        });
        showNotification(`已添加用户 ${username} 到黑名单`);
    }

    saveBlockList();
    handleComments();
}

// 优化等待评论区加载的函数
function waitForComments() {
    return new Promise((resolve) => {
        const commentTable = document.querySelector(SELECTORS.COMMENT_TABLE);
        if (commentTable?.querySelector(SELECTORS.USERNAME)) {
            resolve();
            return;
        }

        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(() => {
            const commentTable = document.querySelector(SELECTORS.COMMENT_TABLE);
            if (commentTable?.querySelector(SELECTORS.USERNAME)) {
                clearInterval(interval);
                resolve();
                return;
            }

            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

// 根据用户名查找用户ID
function findUserIdByUsername(username) {
    const comments = document.querySelectorAll(SELECTORS.COMMENT_ROW);
    for (const comment of comments) {
        const usernameEl = comment.querySelector(SELECTORS.USERNAME);
        if (usernameEl && usernameEl.textContent.trim() === username) {
            return comment.id.replace('comment', '');
        }
    }
    return null;
}

// 修改初始化函数
(function() {
    'use strict';
    
    // 1. 首先加载黑名单数据
    loadBlockList();
    
    // 2. 添加UI界面
    addBlocklistUI();
    addContextMenu();

    // 3. 等待评论区出现后再处理
    waitForComments().then(() => {
        handleComments();

        // 4. 设置评论区监听器
        const commentList = document.querySelector('#comment_list');
        if (commentList) {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        handleComments();
                    }
                }
            });

            observer.observe(commentList, {
                childList: true,
                subtree: true
            });
        }
    });
})();
