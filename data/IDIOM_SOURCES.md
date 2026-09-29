# 释义与出处数据

网站和桌面版按当前成语查询 `idioms copy.json`。`idioms.json` 保留原有题库、难度和顺序；标注副本保留同样的 easy / medium / hard 分组，组内改为对象记录。两份文件不得各自增删题目，更新题库后应重新运行标注脚本。

## 数据结果

当前共 7,545 条题目，其中 7,445 条由词典精确匹配、繁简词条匹配或明确的完整俗语关联得到，100 条为 LLM 补充说明并标记待核对。7,259 条记录了词典提供的出处／典源，其余 286 条的出处数组为空。完整俗语关联会显示「参照词条」，并不宣称四字片段本身是标准成语。`东成西就`、`见龙卸甲` 未查到可靠的通用成语释义，补充说明中明确保留这一限制。

优先从简体成语语料库取释义，其他来源分别补齐缺失的释义和出处。下载了七套批量数据，之后对 104 个剩余条目查询汉典公开页面，取得 4 条释义，才对最后 100 条进行补充。没有逐条调用 LLM 给全部题库标注，也没有通过 LLM 生成出处。

## 字段

- `word`：题目原文。
- `explanation`：释义原文或标记为待核对的补充说明。
- `explanationSource`、`sourceWord`、`sourceUrl`：释义采用的数据来源及其原词条。
- `origins`：出处列表，每项包含原文 `text`、独立的 `sourceId`、`sourceWord`、`sourceUrl`。
- `kind`：`dictionary` 为来源标注的出处，`related` 为明确关联词条的典源，`paraphrase` 为根据典源概括形成。不能仅凭是否包含四个字自动判定出处关系。
- `referenceWord`、`note`：关联词条及必要的关系说明。
- `status`：`dictionary` 为词典数据，`generated` 为 LLM 补充且待核对，`missing` 为暂缺。
- `relatedWord`：明确的完整俗语／异写参照。展示时注明释义属于该词条。

未把 `example` 或教育部数据中的 `書證` 当作成语最早出处。`走马观花` 按教育部明确的「走馬看花」关联记录孟郊诗意概括和《圍爐詩話》另一典源说法；不宣称这些资料已经证明唯一的最早出处。

## 来源与许可

完整来源、仓库版本、下载地址、SHA-256 及来源说明见 `idiom-sources.json`。网页底部也提供资料来源，释义和每项出处各自显示来源信息。

- [在线成语词典语料库](https://github.com/jaaack-wang/Chinese-fixed-phrases-idioms)：30,310 条成语及俗语，保留原在线词典的逐条链接。仓库未声明独立数据许可。
- [chinese-xinhua](https://github.com/pwxcoo/chinese-xinhua)：网络汇编的成语库与词语库，**并非新华字典出版社官方数据库**。仓库标注 MIT，README 明确说明从网络抓取；代码许可不替代上游内容权利。
- [chinese-idiom](https://github.com/Li1Fan/chinese-idiom)：网络汇编数据，仓库标注 MIT，作者说明仅作学习使用。
- [Chinese idiom data](https://github.com/by-syk/chinese-idiom-db)：作者说明是非官方渠道且未经严格校对；未发现独立数据许可。
- [教育部《成语典》JSON 整理版](https://github.com/doggy8088/dict-idioms-2020)：20260324 版本；可与[官方资料下载](https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_idiomsdict_download.html)核对。资料采用 CC BY-ND 3.0 TW。所用内容保留原文，繁简转换仅用于匹配词头。页面展示只去除原资料脚注编码，不重写辞典内容。
- [教育部《重编国语辞典修订本》JSON](https://github.com/g0v/moedict-data)：使用仓库的 `dict-revised_bkup.json`，不是重新生成的最新版；资料本文版权仍属教育部，采用 CC BY-ND 3.0 TW，格式转换的编辑著作权以 CC0 释出。
- [汉典](https://www.zdic.net/)：对批量数据缺失项查询公开页面，保留原文及逐条链接。

本数据采用教育部《成语典》及《重编国语辞典修订本》之部分内容。教育部公眾授權字詞資料來源網站：[《成语典》](https://dict.idioms.moe.edu.tw/)、[《重编国语辞典修订本》](https://dict.revised.moe.edu.tw/)。上述社区公开仓库可用于技术验证，但不能据仓库代码许可认定其上游词典文本已获得所有再分发授权。

## 可重复运行

先安装项目依赖，再运行：

```powershell
npm.cmd run idioms:download
npm.cmd run idioms:enrich
```

第一次在新机器执行时，按已提交的来源版本下载到 `work/idiom-sources/`。已有缓存会检查 SHA-256 后复用。若明确需要升级来源版本，运行 `node scripts/download-idiom-sources.mjs --refresh`，然后重新标注并检查差异。

补查仍缺释义的词条：

```powershell
npm.cmd run idioms:query-gaps
npm.cmd run idioms:import-pages
npm.cmd run idioms:enrich
```

查询脚本逐条请求并缓存页面，导入脚本只读取匹配当前词头的释义区域，不运行页面脚本、不提取百科和例句作为出处。当前标注结果已有补充说明，缺失清单为空；新词会在重新标注后进入缺失清单。

`idiom-aliases.json` 保留显式关联；`idiom-web-records.json` 保留网页查询结果；`idiom-fallbacks.json` 保留 LLM 补充说明。重新运行不需要再次调用模型。后续查到可靠释义时，词典匹配优先于补充说明。

报告位于 `idiom-enrichment-report.json`。不同来源的释义候选位于缓存目录的 `definition-differences.json`，当前 6,988 条存在不同表述，**不同表述不等于语义冲突或独立来源交叉验证**；需要具体比较词条才能确认。大体量原始下载和候选报告不提交到代码库。

## 验证

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd exec tsc -- --noEmit
npm.cmd run build
npm.cmd run desktop:build
npm.cmd run test:ui
```

UI 验证在隐藏的 Electron 窗口中执行，外部联网被禁用。覆盖释义显隐、换题同步、出处展开、结算回顾、未知 TXT 词条及 390 像素窄屏，截图与报告存放在 `outputs/ui-check/`。
