# DMHY Comment Block Helper

English | [简体中文](./README.md)

## Introduction
A userscript for blocking comments on share.dmhy.org. It helps you:
- Block comments from specific users
- Block comments containing specific keywords
- Support both plain text and regex matching
- Add quick search for usernames: left-click to search user's torrents in new window

## Usage
1. **Manage Blocklist**
   - Click "Manage Comment Blocklist" button in the top-left corner
   - Edit blocklist in the popup manager
   - Separate usernames and keywords with semicolons (;)

2. **Quick Block User**
   - Right-click username in comment section
   - Select "Add to Comment Blocklist"

3. **Advanced Matching**
   - Supports regex using /pattern/ format
   - Example: `username1；/user\d+/；username2`

## Features
- Auto-save blocklist settings
- Real-time effect without page refresh
- User ID binding to prevent bypass through name changes
- Clean and easy-to-use interface

## Notes
- Only works on dmhy topic pages
- Blocklist data is stored in local browser storage
- Supports Chinese usernames and keywords
- Comment user IDs are different from torrent uploader IDs, blocking only works in comment section

## Installation
1. Make sure you have [Tampermonkey](https://www.tampermonkey.net/) installed
2. [Click here](https://raw.githubusercontent.com/xkbkx5904/dmhy-comment-block/main/dmhy_comment_block.user.js) to install the script
3. Visit dmhy topic pages to use

## Development
