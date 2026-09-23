# 成语大会

https://chengyubighui.vercel.app/

根据上级目录 `design.md` 与五张界面草图实现的浏览器小程序，适合聚会、投屏和手机使用。

## 运行

需要 Node.js 22.13 或更新版本。Windows PowerShell：

```powershell
cd chengyu-app
npm.cmd install
npm.cmd run dev
```

打开终端显示的本地地址（默认 http://localhost:3000）。

## 玩法

- 限时：设置秒数，倒计时结束后按答对数量结算。
- 限词：设置目标词数，正计时到猜对目标数量后结束，无时间上限。
- 犯规和跳过只计次，不加分、不扣分，也不因达到参考次数停止。
- 每轮随机且不重复。限词按「目标词数 + 犯规参考次数 + 跳过参考次数 + 10」准备，耗尽时从本轮尚未出现的词中补充。整个题库耗尽会结算。
- 支持点击按钮或方向键：← 犯规，↓ 跳过，→ 答对。可提前结束、全屏显示、查看记录、再来一局。
- 计时依据单调时钟的实际经过时间；切换标签页不会暂停。
- 游戏右上角的「退出本轮」直接返回当前模式的准备界面，清空本轮计时和成绩，保留设置及题库。「结束并结算」仍可用于查看本轮成绩。

## Windows EXE（给朋友使用）

将 `desktop-release/ChengyuDahui-1.0.0-Windows-x64.exe` 发给朋友，双击即可打开独立窗口。不需要安装 npm、Node.js 或另一个运行环境；不需要连接网站，内置题库和 TXT 导入都可以离线使用。

适用于 Windows 10 / 11 的 64 位电脑。此版本为免安装便携版，启动时会解压内置运行环境，首次打开可能稍慢。没有配置商业代码签名证书，Windows 或传输软件可能提示未知发布者。

开发者重新打包：

```powershell
npm.cmd install
npm.cmd run desktop:package
```

桌面版与网页版复用同一套界面和玩法。桌面入口在 `desktop/main.cjs`，只读取打包内的页面资源。打包设置在 `electron-builder.yml`，生成目录 `desktop-release/` 不提交到源代码库。

## 题库

默认题库来源于上级目录 `default.txt`，打包在 `data/default.json`。上传 TXT 仅在浏览器内存中读取，刷新后恢复默认；不会发送到服务器。

支持 UTF-8 / UTF-8 BOM，非 UTF-8 文件尝试以 GB18030 解码。每行可为一个成语或「成语 + 空白 + 频次」。仅保留四个汉字的词条并去重。文件上限 5 MB。

## 检查和构建

```powershell
node --test tests/game.test.mjs
npm.cmd exec tsc -- --noEmit
npm.cmd run build
```

主要逻辑位于 `lib/game.ts`，界面位于 `app/page.tsx`，样式位于 `app/globals.css`。
