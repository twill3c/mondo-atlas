# raw/perseus — 取得の記録

これは **Perseus Digital Library の TEI XML をそのまま固定したもの**である。
加工していない。以後のビルドはこの木だけを見る(SPEC N-02)。

| 項目 | 値 |
|---|---|
| 取得元 | `https://github.com/PerseusDL/canonical-greekLit` |
| 上流コミット | `a1849c8f50622ebaa77926f09c81c05c3b3b23af`(2026-08-31T14:29:37Z) |
| 取得日 | 2026-09-02 |
| 対象 | `data/tlg0059/tlg001`–`tlg036` の希語版・英語版 |
| ファイル数 | 72(希 36 / 英 36) |
| 版の選択 | `perseus-grc2` / `perseus-eng2` を優先し、無い場合のみ `…1` を使う |

## 底本

- 希語: John Burnet (ed.), *Platonis Opera*, Oxford: Clarendon Press, 1900–1907(OCT)
- 英訳: Harold North Fowler / Walter R. M. Lamb ほか,
  *Plato in Twelve Volumes*, Loeb Classical Library,
  Cambridge MA: Harvard University Press / London: William Heinemann, 1914–

## ライセンス

Perseus のデータは **CC BY-SA 4.0**。本リポジトリの派生データおよび和訳もこれを継承する。
コードのみ MIT(`LICENSE` を参照)。

## 更新について

底本は改訂されないため、**定期更新の経路を持たない**(SPEC N-01: cron ゼロ・関数ゼロ)。
上流の校訂改訂を取り込む場合は、上流コミットを更新したうえで
全ゲート(G-01〜G-05)を再実行し、差分をループログに記録すること。
