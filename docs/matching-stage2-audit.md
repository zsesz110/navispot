# 第二阶段 Navidrome 只读审计（基线 63/5/58）

审计日期：2026-10-05。对原有 58 首未匹配曲目逐首记录 Spotify 元数据、既有标题查询与候选数，并只读查询标题变体及缓存的艺人曲库。`ABSENT` 指本次索引和录音资料中**未找到可信的同一录音**，不是证明任何其他资料库都不存在。

分类数按修复前的失败原因统计；分类不等于修复后的状态。

| 分类 | 数量 |
|---|---:|
| ABSENT | 24 |
| TITLE_TRANSLATION | 13 |
| BILINGUAL_TITLE | 4 |
| ARTIST_METADATA | 4 |
| VERSION_MISMATCH | 6 |
| AMBIGUOUS | 0 |
| OTHER | 7 |

## 58 首逐项分类

表中的“现有查询”是修复前实际构造的查询；“候选”是当时标题检索结果数。“诊断”汇总额外标题变体、艺人目录、时长和专辑检查。

| # | Spotify 曲名 / 艺人 | 专辑 / 秒 | 现有查询；候选 | 分类 | 只读诊断 |
|---:|---|---|---|---|---|
| 10 | 和散那: 高舉耶穌<br>Joshua Band | 為著你的榮耀<br>364 | 和散那: 高舉耶穌<br>和散那: 高举耶稣<br>候选 0 | BILINGUAL_TITLE | 冒号复合标题；同艺人同专辑有《和散那》364.30 秒，也有另一首 364.10 秒，不能只凭时长。 |
| 15 | 我要愛慕你<br>Joshua Band | 堅強的愛<br>289 | 我要愛慕你<br>我要爱慕你<br>候选 1 | VERSION_MISMATCH | 同名同艺人同专辑仅 174.73 秒，本曲 289 秒；录音版本明显不同。 |
| 18 | You Surround Me<br>Stream of Praise | Morning to Night<br>287 | You Surround Me<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 141 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 21 | This Is the Day<br>Stream of Praise | I Want to See<br>189 | This Is the Day<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 68 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 23 | My Voice Has Power<br>Stream of Praise | Morning to Night<br>274 | My Voice Has Power<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 106 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 25 | Into Deeper Waters<br>Stream of Praise | Morning to Night<br>380 | Into Deeper Waters<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 35 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 29 | God of Miracles<br>Stream of Praise | I Want to See<br>234 | God of Miracles<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 105 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 31 | Come Close<br>Stream of Praise | I Want to See<br>396 | Come Close<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 31 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 32 | My Voice Has Power<br>Stream of Praise | High to the Sky<br>211 | My Voice Has Power<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 107 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 34 | Rain Down Your Power<br>Stream of Praise | Made New<br>237 | Rain Down Your Power<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 106 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 37 | Trusting in Your Promises<br>Stream of Praise | Morning to Night<br>204 | Trusting in Your Promises<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 107 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 38 | Let Me Stay<br>Stream of Praise | Made New<br>229 | Let Me Stay<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 114 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 39 | 到各山嶺去傳揚 Go Tell It On the Mountain<br>聖歌特讚隊 | 聖歌特讚隊: 特讚聖誕 Hymn Squad: Mega Christmas<br>179 | 到各山嶺去傳揚 Go Tell It On the Mountain<br>到各山岭去传扬 Go Tell It On the Mountain<br>候选 0 | ARTIST_METADATA | 双语标题可检索到《到各山岭去传扬》179.51 秒；艺人多“欧赞”前缀，专辑同为特赞圣诞。 |
| 42 | 呼求之歌(Cry Out)<br>Joshua Band | 我願降服 不插電 (I Surrender Acoustic Live)<br>275 | 呼求之歌(Cry Out)<br>呼求之歌<br>候选 1 | BILINGUAL_TITLE | 括号英译掩盖中文主标题；《呼求之歌》273.31 秒同艺人。 |
| 46 | 和撒那 (Hosanna)<br>Hillsong 華語 | Global Project 華語 (Mandarin)<br>349 | 和撒那 (Hosanna)<br>和撒那<br>候选 0 | ABSENT | 标题变体最近候选《Hosanna贺我王》/ 角声使团，差 92.85 秒；未满足同艺人及同录音证据。 |
| 50 | Come to Worship<br>Stream of Praise | Made New<br>218 | Come to Worship<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 114 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 51 | 罪人的朋友 (Friend of Sinners)<br>Lifesong Worship | 詠生敬拜 - 不在祢以外 (In You Alone)<br>314 | 罪人的朋友 (Friend of Sinners)<br>罪人的朋友<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 53 | 耶穌裡面 (In Christ)<br>Lifesong Worship | 詠生敬拜 - 不在祢以外 (In You Alone)<br>360 | 耶穌裡面 (In Christ)<br>耶稣里面 (In Christ)<br>耶穌裡面<br>耶稣里面<br>候选 0 | ABSENT | 标题变体最近候选《In Christ Alone》/ 外文诗歌，差 117.50 秒；未满足同艺人及同录音证据。 |
| 54 | Glorious Calling<br>Stream of Praise | Made New<br>295 | Glorious Calling<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 108 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 55 | Let Me Stay / With All My Love<br>Stream of Praise | Twinkle, Twinkle<br>289 | Let Me Stay / With All My Love<br>Let Me Stay<br>候选 0 | VERSION_MISMATCH | 官方曲目是《能不能／一生爱祢》串烧，不能用单曲《能不能》229.20 秒替代。 |
| 56 | Jesus Lives In Me 耶穌在我裡面<br>Amy Sand 盛曉玫 | Blessed 幸福<br>339 | Jesus Lives In Me 耶穌在我裡面<br>Jesus Lives In Me 耶稣在我里面<br>候选 0 | ARTIST_METADATA | 本地《耶稣在我里面》335.93 秒，艺人写“泥土音乐”而非 Amy Sand；身份未核实，不自动匹配。 |
| 58 | My Abba Father<br>Stream of Praise | I Believe<br>417 | My Abba Father<br>候选 0 | TITLE_TRANSLATION | 已缓存同艺人 1436 首，其中 ±8 秒 20 首；原查询无中文标题候选；随后按官方双语目录确认译名，仍不能单凭时长推断。 |
| 61 | 我要愛慕你<br>巫啟賢 | 一生敬拜彌賽亞<br>262 | 我要愛慕你<br>我要爱慕你<br>候选 1 | ABSENT | 同标题仅见不同艺人、174.73 秒录音；目标为 262 秒。 |
| 62 | Hosanna / What A Beautiful Name<br>紀文惠, 巫詠歡HAPPY | 一生敬拜彌賽亞<br>384 | Hosanna / What A Beautiful Name<br>Hosanna<br>候选 3 | VERSION_MISMATCH | 两曲串烧；本地仅找到其他艺人的单首歌。 |
| 63 | 不再被奴役<br>巫啟賢 | 一生敬拜彌賽亞<br>340 | 不再被奴役<br>候选 1 | ABSENT | 标题变体最近候选《不再被奴役》/ 约书亚乐团，差 32.65 秒；未满足同艺人及同录音证据。 |
| 64 | 我神真偉大 / 你真偉大<br>巫啟賢 | 一生敬拜彌賽亞<br>382 | 我神真偉大 / 你真偉大<br>我神真伟大 / 你真伟大<br>我神真偉大<br>我神真伟大<br>候选 1 | VERSION_MISMATCH | 两曲串烧；本地只有单首或不同版本。 |
| 66 | 祢愛偉大<br>Hillsong 華語, Joshua Band | 何等榮美的名<br>321 | 祢愛偉大<br>祢爱伟大<br>候选 0 | OTHER | “祢/你”字形造成检索遗漏；同艺人同专辑《你爱伟大》321.55 秒。 |
| 68 | 別站在我墓前哭泣<br>Tom Read | 指引<br>232 | 別站在我墓前哭泣<br>别站在我墓前哭泣<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 75 | I Will Go For You 我願為祢去<br>Sehlin 林婉容 & Lamb Music 小羊詩歌 | Lamb Music 小羊詩歌: I Do 我願意<br>344 | I Will Go For You 我願為祢去<br>I Will Go For You 我愿为祢去<br>候选 0 | BILINGUAL_TITLE | 中英混合标题及组合艺人；《我愿为你去》342.26 秒、艺人小羊诗歌。 |
| 77 | 十架上的愛<br>柳子駿 | 復興<br>316 | 十架上的愛<br>十架上的爱<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 79 | 指引<br>Tom Read | 指引<br>251 | 指引<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 80 | 與我同行<br>Tom Read | 指引<br>380 | 與我同行<br>与我同行<br>候选 1 | ABSENT | 同名本地录音由另一艺人演唱，时长差 130.47 秒。 |
| 81 | 每當我瞻仰你<br>Jesus Fashion Family, 陳威全, Jane Huang, 羅文裕 | Jesus Fashion 2.0<br>414 | 每當我瞻仰你<br>每当我瞻仰你<br>候选 1 | ARTIST_METADATA | 同名但本地艺人不同，时长差 17.90 秒；不足以认定同录音。 |
| 82 | 烈火中有祂<br>Hillsong 華語, 李翔 | 萬王之王<br>396 | 烈火中有祂<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 83 | 唯有我主<br>Hillsong 華語, 李翔 | 萬王之王<br>423 | 唯有我主<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 85 | 祢的器皿<br>Stream of Praise | 新的事將要成就 (敬拜讚美專輯20)<br>267 | 祢的器皿<br>候选 0 | OTHER | “祢/你”字形遗漏；同艺人同专辑《你的器皿》268.02 秒。 |
| 88 | 名分祢已赐给我<br>Hillsong 华语 | 名分祢已赐给我<br>333 | 名分祢已赐给我<br>候选 1 | ABSENT | 标题变体最近候选《名分祢已赐给我我渴望看见我深渴望天父的歌》/ KUA GLOBAL 跨越，差 1075.94 秒；未满足同艺人及同录音证据。 |
| 89 | 祢的愛呼喚我<br>Tom Read | 指引<br>287 | 祢的愛呼喚我<br>祢的爱呼唤我<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 91 | 祢永遠如此深愛著我<br>Stream of Praise | 我相信 (敬拜讚美專輯24)<br>342 | 祢永遠如此深愛著我<br>祢永远如此深爱着我<br>候选 0 | OTHER | 本地《你永远如此深爱我》342.57 秒、专辑 I Believe；“著”字及专辑译名仍需谨慎核实。 |
| 94 | 住在祢裡面<br>Stream of Praise | 相信有愛就有奇蹟 (敬拜讚美專輯16)<br>192 | 住在祢裡面<br>住在祢里面<br>候选 1 | OTHER | 同艺人目录存在《住在你里面》192.91 秒，原查询因“祢/你”遗漏。 |
| 95 | 有誰能像祢 There Is None Like You<br>Amy Sand | Right Here<br>237 | 有誰能像祢 There Is None Like You<br>有谁能像祢 There Is None Like You<br>候选 0 | ARTIST_METADATA | 英文部分有相近本地曲目但艺人、专辑与时长不一致；未核实同录音。 |
| 96 | 耶穌祢已得勝<br>天韻合唱團 | 更新<br>269 | 耶穌祢已得勝<br>耶稣祢已得胜<br>候选 0 | OTHER | “祢/你”字形遗漏；同艺人同专辑《耶稣你已得胜》269.46 秒。 |
| 98 | 祢專屬的花園<br>陳欣恩 | 與祢面對面<br>342 | 祢專屬的花園<br>祢专属的花园<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 99 | 祢永遠如此深愛著我<br>Stream of Praise | 深愛我的主 (《天堂敬拜 Live》第三季 Ep01)<br>358 | 祢永遠如此深愛著我<br>祢永远如此深爱着我<br>候选 0 | VERSION_MISMATCH | 同名附近有 342.57 秒录音；目标为 358 秒 Live，不能替代。 |
| 100 | 能不能<br>Stream of Praise | 深愛我的主 (《天堂敬拜 Live》第三季 Ep01)<br>137 | 能不能<br>候选 9 | VERSION_MISMATCH | 目标为 137 秒 Live；本地 229.20 秒单曲与 148.69 秒创意教室串烧均非同版。 |
| 101 | 更堅固 (Stronger)<br>Hillsong 華語 | Global Project 華語 (Mandarin)<br>260 | 更堅固 (Stronger)<br>更坚固 (Stronger)<br>更堅固<br>更坚固<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 102 | 大能拯救 (Mighty To Save)<br>Hillsong 華語 | Global Project 華語 (Mandarin)<br>302 | 大能拯救 (Mighty To Save)<br>大能拯救<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 104 | 我的禱告你聽得到<br>TANK 呂建忠 | 我的禱告你聽得到<br>338 | 我的禱告你聽得到<br>我的祷告你听得到<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 109 | 我救主活者<br>Joshua Band | 觸摸到你<br>239 | 我救主活者<br>候选 0 | OTHER | 《我救主活着》239.81 秒同艺人同专辑，但“者/着”需人工确认标题。 |
| 110 | 當我抬頭仰望<br>火把音樂 | 當我抬頭仰望<br>300 | 當我抬頭仰望<br>当我抬头仰望<br>候选 1 | BILINGUAL_TITLE | 本地标题为《当我抬头仰望 When I Look at the Sky》，同艺人，差 3.41 秒。 |
| 111 | 哈利路亞這邊<br>KUA Worship | 跨越原創詩歌 VOL.1<br>302 | 哈利路亞這邊<br>哈利路亚这边<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 112 | 若有人在基督裡<br>KUA Worship | 跨越原創詩歌 VOL.1<br>274 | 若有人在基督裡<br>若有人在基督里<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 115 | 主你是我們的太陽<br>Joshua Band | 主祢是我們的太陽 (大衛帳幕的榮耀敬拜禱告系列專輯第十輯)<br>365 | 主你是我們的太陽<br>主你是我们的太阳<br>候选 0 | ABSENT | 同艺人目录未发现可信同标题/同录音。 |
| 116 | 我願為祢去<br>小羊詩歌, SehLin | 我願意<br>342 | 我願為祢去<br>我愿为祢去<br>候选 0 | OTHER | “祢/你”字形遗漏；本地《我愿为你去》342.26 秒同艺人。 |
| 118 | 讓我<br>新店行道會, 張康利 | Salt and Light<br>353 | 讓我<br>让我<br>候选 27 | ABSENT | 标题过短，现有 27 候选均缺可靠艺人对应；不可凭相近时长猜测。 |
| 119 | 當轉眼仰望耶穌<br>Charis | 只要耶穌<br>111 | 當轉眼仰望耶穌<br>当转眼仰望耶稣<br>候选 2 | ABSENT | 标题变体最近候选《当转眼仰望耶稣 Turn Your Eyes Upon Jesus》/ 欧赞圣歌特赞队，差 157.17 秒；未满足同艺人及同录音证据。 |
| 120 | 自耶穌來住在我心<br>Charis | 只要耶穌<br>191 | 自耶穌來住在我心<br>自耶稣来住在我心<br>候选 0 | ABSENT | 额外标题变体及精确艺人目录查询未找到可信同录音。 |
| 121 | 耶穌恩友<br>Charis | 只要耶穌<br>177 | 耶穌恩友<br>耶稣恩友<br>候选 2 | ABSENT | 标题变体最近候选《人人都应该知道 + 耶稣恩友》/ 欧赞圣歌特赞队，差 40.18 秒；未满足同艺人及同录音证据。 |

## 原有 5 首待确认曲目

以下分数为修复前结果。完整候选元数据来自同次只读审计。

| # | Spotify 曲名 / 艺人 / 专辑 / 秒 | 首位候选（曲名；艺人；专辑；秒；分数） | 次位候选（同上） | 原因 |
|---:|---|---|---|---|
| 70 | 揀選；Stream of Praise；寶貴十架 (敬拜讚美專輯11)；204 | 拣选；赞美之泉音乐事工；宝贵十架；204.04；0.950 | 拣选；赞美之泉音乐事工；（演奏专辑）你恩典不离开；206.16；0.950 | 人声原专辑与演奏专辑打平。 |
| 71 | 深觸我心；Stream of Praise；深觸我心 (敬拜讚美專輯9)；279 | 深触我心；赞美之泉音乐事工；深触我心；277.06；0.950 | 深触我心；赞美之泉音乐事工；（演奏专辑）深深爱你；277.40；0.950 | 人声原专辑与演奏专辑打平。 |
| 87 | 和散那；Joshua Band；Happy Day；334 | 和散那Hosanna；约书亚乐团；Happy Day；334.79；0.851 | 和散那；约书亚乐团；向列国宣告；318.07；0.807 | 同艺人两种《和散那》，分差小于 0.05。 |
| 122 | 你們要讚美耶和華；Stream of Praise；耶和華祝福滿滿 (敬拜讚美專輯2)；117 | 你们要赞美耶和华；赞美之泉音乐事工；耶和华祝福满满；117.06；0.950 | 你们要赞美耶和华；赞美之泉音乐事工；（演奏专辑）生命的凯歌；118.06；0.950 | 人声原专辑与演奏专辑打平。 |
| 124 | 我要向高山舉目；Stream of Praise；小小的夢想 (兒童敬拜讚美專輯1)；199 | 我要向高山举目；赞美之泉音乐事工；最珍贵的角落；199.97；0.950 | 我要向高山举目；赞美之泉音乐事工；小小的梦想；196.60；0.950 | 同艺人、同歌名不同专辑录音，时长都接近。 |

官方英中标题依据：[Stream of Praise 官方歌名目录](https://sop.org/en/powerpoint/)。

安全原则：未经核实的英中对译不自动匹配；不以同艺人和接近时长单独定案；串烧、现场版、伴奏版与人声单曲必须区分。

## 修复后 126 首真实只读复核

基线：63 匹配、5 待确认、58 未匹配。修复后：**88 匹配、1 待确认、37 未匹配**。原有 63 首匹配无回退。原未匹配中新增 21 首；原待确认中明确 4 首。

按每首的主要修复原因互斥计数：已核实英中歌名别名 13、双语标题变体 3、多人艺人语义重叠 2、其他中文礼拜代词变体 3；另有唱片标题及录音证据消除待确认 3、双语标题消除待确认 1。英文曲名映射经[赞美之泉官方双语歌名目录](https://sop.org/en/powerpoint/)核对，本地录音亦经只读曲库核对。

| # | 原状态→新状态 | Spotify → 本地 | 时长差 | 分数 | 信心证据 / 主要修复原因 |
|---:|---|---|---:|---:|---|
| 18 | unmatched→匹配 | You Surround Me → 围绕我（赞美之泉音乐事工；从早晨到夜晚） | 0.84 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 21 | unmatched→匹配 | This Is the Day → 这是耶和华所定日子（赞美之泉音乐事工；我要看见） | 0.70 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 23 | unmatched→匹配 | My Voice Has Power → 我的声音带有能力（赞美之泉音乐事工；从早晨到夜晚） | 1.62 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 25 | unmatched→匹配 | Into Deeper Waters → 水深之处（赞美之泉音乐事工；从早晨到夜晚） | 3.37 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 29 | unmatched→匹配 | God of Miracles → 行神迹的神（赞美之泉音乐事工；我要看见） | 0.71 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 31 | unmatched→匹配 | Come Close → 近前来（赞美之泉音乐事工；我要看见） | 0.59 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 32 | unmatched→匹配 | My Voice Has Power → 我的声音带有能力（赞美之泉音乐事工；High to the Sky） | 0.64 秒 | 0.996 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 34 | unmatched→匹配 | Rain Down Your Power → 降下你大能（赞美之泉音乐事工；新的事将要成就） | 0.48 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 37 | unmatched→匹配 | Trusting in Your Promises → 信靠每一句应许（赞美之泉音乐事工；从早晨到夜晚） | 1.35 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 38 | unmatched→匹配 | Let Me Stay → 能不能（赞美之泉音乐事工；新的事将要成就） | 0.20 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 39 | unmatched→匹配 | 到各山嶺去傳揚 Go Tell It On the Mountain → 到各山岭去传扬（欧赞圣歌特赞队；特赞圣诞） | 0.51 秒 | 0.950 | 双语/混合标题中的中文部分与本地歌名对应；艺人、时长支持。 |
| 50 | unmatched→匹配 | Come to Worship → 前来敬拜（赞美之泉音乐事工；新的事将要成就） | 0.57 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 54 | unmatched→匹配 | Glorious Calling → 荣耀的呼召（赞美之泉音乐事工；新的事将要成就） | 0.99 秒 | 0.950 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 58 | unmatched→匹配 | My Abba Father → 天父（赞美之泉音乐事工；I Believe） | 0.88 秒 | 0.995 | 官方英中歌名对应；同艺人；标题对应且时长接近。 |
| 66 | unmatched→匹配 | 祢愛偉大 → 你爱伟大（约书亚乐团；何等荣美的名） | 0.55 秒 | 0.997 | 合作艺人逐项比较；中文“祢/你”变体；同艺人且时长接近。 |
| 70 | ambiguous→匹配 | 揀選 → 拣选（赞美之泉音乐事工；宝贵十架） | 0.04 秒 | 1.000 | 人声版同名同艺人，Spotify 专辑编号后缀剥离后与本地原专辑一致；演奏专辑被排除。 |
| 71 | ambiguous→匹配 | 深觸我心 → 深触我心（赞美之泉音乐事工；深触我心） | 1.94 秒 | 0.988 | 人声版同名同艺人，Spotify 专辑编号后缀剥离后与本地原专辑一致；演奏专辑被排除。 |
| 75 | unmatched→匹配 | I Will Go For You 我願為祢去 → 我愿为你去（小羊诗歌；《我愿意》（四）） | 1.74 秒 | 0.950 | 双语/混合标题中的中文部分与本地歌名对应；艺人、时长支持。 |
| 85 | unmatched→匹配 | 祢的器皿 → 你的器皿（赞美之泉音乐事工；新的事将要成就） | 1.02 秒 | 0.994 | 中文“祢/你”变体；同艺人同专辑且时长接近。 |
| 87 | ambiguous→匹配 | 和散那 → 和散那Hosanna（约书亚乐团；Happy Day） | 0.79 秒 | 0.995 | 本地双语标题同名同艺人、同专辑 Happy Day，时长比另一同名版本更近。 |
| 94 | unmatched→匹配 | 住在祢裡面 → 住在你里面（赞美之泉音乐事工；相信有爱，就有奇迹） | 0.91 秒 | 0.995 | 中文“祢/你”变体；同艺人同专辑且时长接近。 |
| 96 | unmatched→匹配 | 耶穌祢已得勝 → 耶稣你已得胜（天韵合唱团；更新） | 0.46 秒 | 0.997 | 中文“祢/你”变体；同艺人同专辑且时长接近。 |
| 110 | unmatched→匹配 | 當我抬頭仰望 → 当我抬头仰望 When I Look at the Sky（火把音乐；火把音乐-单曲） | 3.41 秒 | 0.950 | 双语/混合标题中的中文部分与本地歌名对应；艺人、时长支持。 |
| 116 | unmatched→匹配 | 我願為祢去 → 我愿为你去（小羊诗歌；《我愿意》（四）） | 0.26 秒 | 0.998 | 合作艺人逐项比较；中文“祢/你”变体；同艺人且时长接近。 |
| 122 | ambiguous→匹配 | 你們要讚美耶和華 → 你们要赞美耶和华（赞美之泉音乐事工；耶和华祝福满满） | 0.06 秒 | 1.000 | 人声版同名同艺人，Spotify 专辑编号后缀剥离后与本地原专辑一致；演奏专辑被排除。 |

## 仍待人工确认

第 124 首《我要向高山舉目》仍有两首赞美之泉同名录音：本地《小小的梦想》196.60 秒（评分 0.986）与《最珍贵的角落》199.97 秒（评分 0.950）；Spotify 为《小小的夢想》199 秒。专辑支持前者，时长更支持后者，因此保持待确认。

第 42 首《呼求之歌(Cry Out)》经双语检索找到了同艺人 273.31 秒录音，但 Spotify 专辑带 Live 标记，本地只标 Acoustic；未证明录音版本相同，故保留未匹配。第 91 首《祢永遠如此深愛著我》有近似中文标题与 342.57 秒录音，但多出“著”且专辑英中异名；未加未经官方核实的别名。第 99、100 首为现场或串烧差异，均未自动匹配。

建议界面在绿色匹配与红色未匹配之间加琥珀色“? 待确认”计数，并明确显示三项合计 126；本次未改 UI。
