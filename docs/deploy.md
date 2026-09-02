# デプロイの手引き(2026-09-02 時点の実測)

## 本番

**https://mondo-atlas-coral.vercel.app/**

`mondo-atlas.vercel.app` は**他者が使用中**(`vercel domains add` が 403
`The chosen alias is already in use`)。Vercel が自動で付けた `-coral` 付きの別名が本番になる。
kokoro-graph と同じ事情なので、無理に取りに行かない。

## 方式

**CLI 運用。GitHub 連携は張っていない。**

```bash
npm run deploy        # vercel deploy --prod --yes --scope twill3c-8670s-projects --archive=tgz
npm run smoke:prod    # 本番 URL に対して実ブラウザ検品
```

- `git push` では本番は変わらない。**出したいときは明示的に deploy する。**
- Vercel は Next.js としてリモートでビルドする(`vercel.json` に `outputDirectory` を書いていない)。
  `out/` を gitignore していても本番が空になる事故は起きない。
- スコープは `twill3c-8670s-projects`。

## `.vercelignore` を先に書く

Free プランは **24 時間あたり 5,000 ファイル**が上限で、一度触れると 24 時間デプロイできない。
`raw/perseus`(TEI 72 ファイル・16 MB)も `node_modules` もビルドには要らないので送らない。
`--archive=tgz` は 1 個のアーカイブとして送るので、この制限を避けられる。

**削った後の木でビルドできることを確かめてから足すこと**(HC-062)。

```bash
node etl/explore/pruned_build_check.mjs <作業ディレクトリ>
```

`.vercelignore` を読んでトップ階層を実際に削った複製を作り、`npm ci` と `next build` を通し、
出荷 HTML に主要な文言が入っていることまで見る。

## 日次上限

**100 デプロイ/日・アカウント全体**(プロジェクト単位ではない)。フリートは 80 本超あるので、
まとめて出す日は昼のうちに枯れることがある。上限は「1 日 1 回」ではなく
**24 時間の移動窓で枠が 1 つずつ空く**。

- 上限に当たると **Git 連携も止まる**(push しても新しいデプロイが 1 件も現れない)
- 失敗したデプロイは**自動で再試行されない**
- 一日に何本も出す日は、**app-menu への掲載を先に済ませる**
  —— 本体を出してからカードを足すと、上限に当たったとき掲載だけが取り残される

## 本番の検品を手元の検品と別に持つ

`npm run smoke` は `out/` を、`npm run smoke:prod` は**配られているもの**を見る。
両者は同じ判定規則を使うが、本番側だけが見られるものがある:

- 配信の **Content-Type**(静的書き出しは拡張子の無いファイルを作ることがあり、
  `application/octet-stream` で配られる。ローカルの出荷物検査では原理的に見つからない — HC-048)
- 反映漏れ(commit status は経路の成否しか語らない。**本番 URL を実際に引いて判定する**)

判定に `vercel ls` を使わない。Age 列が実際と大きくずれることがある。

## 書体を配るなら、配られていることを確かめる

画面⑥は希語を**同梱の書体**(`public/fonts/*.woff2`)で組む。
`npm run smoke:prod` の字形検査は「EB Garamond で描かれた」としか言わないので、
**その機に同名の書体が入っていれば、配信が 404 でも緑になる**。
本番では別に確かめる:

```bash
curl -sS -o /dev/null -w "%{http_code} %{content_type} %{size_download}
"   https://mondo-atlas-coral.vercel.app/fonts/ebgaramond-greek-ext.woff2
```

2026-09-02 実測: 三つとも `200 font/woff2`(6,464 / 10,752 / 23,820 B)。
この機に Garamond 系のシステム書体が無いことも確認したので、
描いたのは**配られた実体**である。

## 実測(2026-09-02 初回デプロイ)

| 項目 | 値 |
|---|---|
| デプロイ ID | `dpl_AZMvviakrtCVxrwjfX6sMGQCWHrF` |
| 本番 | https://mondo-atlas-coral.vercel.app/ |
| 検品 | 390 / 768 / 1280 px の 3 幅すべて合格、Content-Type は `text/html` |

## 実測(2026-09-02 二回目・L2〜L7 の反映)

| 項目 | 値 |
|---|---|
| デプロイ ID | `dpl_4wYZ7aoJJJDC8u2efjjYAeM821zr` |
| 本番 | https://mondo-atlas-coral.vercel.app/ |
| 検品 | 3 幅 × **6 画面** + 直リンク 7 件 + 字形 1 件、すべて合格 |
| 書体 | `/fonts/*.woff2` 三つが `200 font/woff2` で配られている |
