<div align="center">

# 📺 哔哩哔哩网页版触控手势助手
### Bilibili Touch Controller for Windows & Microsoft Edge / Chrome

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Edge%20%7C%20Chrome-blue.svg?style=flat-square)](https://www.microsoft.com/edge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-pink.svg?style=flat-square)](CONTRIBUTING.md)

**专为 Windows 触屏设备（Surface、二合一笔记本、触屏轻薄本）与 Microsoft Edge 量身打造的 B 站网页端触控增强扩展。**  
彻底解决网页端触控误触为鼠标点击、无法手势快进/快退的痛点，赋予网页端媲美移动 App 的丝滑手势体验！

[✨ 核心特性](#-核心特性) • [🚀 安装步骤](#-安装步骤) • [🎮 手势指南](#-手势操作指南) • [⚙️ 设置面板](#️-个性化配置) • [📖 原理解析](docs/ARCHITECTURE.md)

</div>

---

## 🌟 核心特性

- ⏩ **左右水平滑动快进 / 快退**：
  - 向左滑动快退，向右滑动快进。
  - 屏幕中央弹出**磨砂玻璃 HUD 浮层**，实时显示进度跳转差值（如 `+15s` / `-20s`）、目标时间戳与进度条，松手精准跳转。
  - 支持灵敏度跨度调节（30s ~ 240s）。
- ☀️ / 🔊 **双区分区垂直滑动**：
  - **屏幕左半区垂直滑动**：无级调节画面明暗亮度（20% ~ 200%）。
  - **屏幕右半区垂直滑动**：平滑调节视频原生音量（0% ~ 100%）。
- ⚡ **长按屏幕高倍速播放**：
  - 按住屏幕任意位置超过 400ms，自动进入高速播放（默认 2.0x，支持 2.5x / 3.0x / 4.0x），松手立刻还原原倍速。
- ⛶ **双击全屏 / 取消全屏**：
  - 完美保留并增强网页端原生双击习惯：双击视频画面任意位置即可快速进入全屏或退出全屏。
  - 单击唤起/隐藏控制栏，彻底拦截误触暂停。
- 🛡️ **智能防误触与幽灵点击拦截**：
  - 针对 Windows Chromium 触屏特性，彻底拦截手势结束后产生的合成鼠标点击，杜绝“手势滑动完视频自动暂停”的问题。
  - 播放器底部控制栏（清晰度、全屏、弹幕开关等）保留原生穿透，交互互不干扰。
- 🎛️ **实时设置面板**：
  - 点击扩展图标即可弹出设置面板，所有配置秒级热更新，无需刷新页面。

---

## 🎮 手势操作指南

| 手势动作 | 作用区域 | 功能说明 | 屏幕 HUD 反馈 |
| :--- | :--- | :--- | :--- |
| **水平向右划动** | 视频任意区域 | 视频快进 (Seek Forward) | ⏩ 快进 `+Xs`、目标时间戳与进度指示条 |
| **水平向左划动** | 视频任意区域 | 视频快退 (Seek Backward) | ⏪ 快退 `-Xs`、目标时间戳与进度指示条 |
| **垂直上下划动** | 屏幕左半侧 | 调节画面亮度 (20% ~ 200%) | ☀️ 亮度百分比及亮度调节条 |
| **垂直上下划动** | 屏幕右半侧 | 调节视频音量 (0% ~ 100%) | 🔊 音量百分比及音量调节条 |
| **长按画面 (>400ms)** | 视频任意区域 | 临时高倍速播放 | ⏩ `2.0X 倍速播放中` 呼吸动画 |
| **双击画面** | 视频任意区域 | 全屏 / 取消全屏切换 | ⛶ 进入全屏 / 退出全屏 图标提示 |
| **轻点屏幕一次** | 视频区域 | 唤起/隐藏控制栏 | 水波纹触控反馈动画 |

---

## 🚀 安装步骤 (Microsoft Edge / Chrome)

本扩展基于 Chrome / Edge 官方 **Manifest V3** 标准开发，无需打包即可直接在浏览器中以开发者模式加载使用：

### 第一步：打开浏览器扩展管理页面
- 在 **Microsoft Edge** 地址栏输入：`edge://extensions/` 并按回车。
- 或在 **Google Chrome** 地址栏输入：`chrome://extensions/` 并按回车。

### 第二步：开启开发者模式
- 开启页面左侧（或右上角）的 **“开发人员模式”** 开关。

### 第三步：加载解压缩的扩展
1. 点击顶部的 **“加载解压缩的扩展”**（Load unpacked）按钮。
2. 在弹出的文件窗口中选择本项目根目录：
   ```text
   C:\Users\15695\.gemini\antigravity\scratch\bilibili-touch-controller
   ```
3. 点击 **“选择文件夹”**，安装立即完成！
4. 打开或刷新任意 [Bilibili 视频页面](https://www.bilibili.com) 即可享受触控手势。

---

## ⚙️ 个性化配置

点击浏览器右上角扩展栏的粉色小电视图标，即可打开配置弹窗：

- **左右滑动快进/快退开关**：可单独开启或关闭，并可调节滑动跨度（30秒 ~ 240秒）。
- **音量与亮度手势独立开关**：按需启用垂直滑动手势。
- **长按倍速档位选择**：支持 2.0x / 2.5x / 3.0x / 4.0x。
- **双击切换全屏开关**：自由开启或关闭双击全屏手势。
- **鼠标手势模拟**：方便无触屏的台式机开发者用鼠标左键拖拽测试手势效果。

---

## 📂 项目结构

```text
bilibili-touch-controller/
├── manifest.json              # Chrome / Edge Manifest V3 扩展配置文件
├── content/
│   ├── touch-controller.js    # 触控手势捕获、Seek 算法与防误触核心引擎
│   └── touch-overlay.css      # 毛玻璃 HUD 浮层与触控样式
├── popup/
│   ├── popup.html             # 设置弹窗 HTML
│   ├── popup.js               # 设置项逻辑与 storage 同步
│   └── popup.css              # 设置弹窗样式
├── icons/                 # 16px, 48px, 128px 扩展高清图标
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── docs/
│   └── ARCHITECTURE.md        # 详细技术实现与原理解说文档
├── generate-icons.js          # 图标生成脚本 (Node.js)
├── .gitignore
├── LICENSE                    # MIT 开源许可证
└── README.md                  # 项目说明文档
```

---

## 📖 技术原理剖析

想了解触控捕获层、Pointer Events 状态机、动态灵敏度映射以及防误触的具体实现细节，请参阅：
👉 **[详细技术实现与架构解说 (ARCHITECTURE.md)](docs/ARCHITECTURE.md)**

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！
1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 发起 Pull Request

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
