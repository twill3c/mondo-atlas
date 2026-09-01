# 問答アトラス(mondo-atlas)

Perseus Digital Library のプラトン全集 36 篇を、**ステファヌス番号という一本の背骨**で
通して可視化する。

プラトンの著作は「対話篇」と呼ばれるが、対話の濃さは篇によって桁違いに違う。
同じ物差しを全篇に当てて、**どの篇のどこで問答が起き、どこで独白に変わるか**を見せる。

## 現在の状態

**L0 完了(2026-09-02)** —— データの取得・正規化・検査まで。画面はまだ無い。

| 実測(2026-09-02) | 値 |
|---|---|
| 作品 | 36 篇(希 36 / 英 36) |
| ステファヌス節 | 8,559 |
| ステファヌス頁 | 1,752 |
| ギリシャ語本文 | 559,618 語 |
| 英訳 | 888,409 語 |

## L0 でいちばん大事だった発見

**Perseus の話者マークアップ `<said>` は、29/36 篇で印刷面の話者記号 `<label>` と件数が
厳密に一致する。**つまり `<said>` は OCT の紙面に印刷された `ΣΩ.` `ΚΡ.` の写しである。

だから **OCT が話者記号を印刷しない篇 —— 語り直し型の対話篇 —— では使えない。**
『国家』は 88,000 語を超えながら `<said>` が 278 件・話者 1 名しかない。
『パルメニデス』の 1,072 件は**すべて枠の語り手に付いており、その内部に
「とソクラテスが言った」を含む**。

埋め合わせは本文の中にある。語り直し型では話者交替が**叙述内の発話動詞**
(`ἦν δʼ ἐγώ`「と私は言った」/ `ἦ δʼ ὅς`「と彼は言った」)で標示される。
分布は `<label>` ときれいに相補的で、『国家』では 2,136 件。

**『国家』の問答は 278 回ではなく、約 2,000 回起きている。**

詳細は [docs/L0-findings.md](docs/L0-findings.md)。

## 構成

```
raw/perseus/     Perseus TEI 72 ファイル(上流コミット a1849c8 で凍結・無加工)
data/curated/    人が書いた台帳(作品メタデータ・上流誤植の補正表)
data/works/      篇ごとの節データ(生成物)
etl/             正規化器と調査スクリプト
tests/           TEST_SPEC の T-001〜T-016
docs/            ループごとの所見
```

## 使い方

```bash
python etl/normalize.py     # raw/perseus → data/works + data/index.json
python -m pytest -q         # 検査(T-001〜T-016)
python harness/text_hygiene.py
```

## 出典とライセンス

- ギリシャ語本文: John Burnet (ed.), *Platonis Opera*, Oxford: Clarendon Press, 1900–1907
- 英訳: Fowler / Lamb ほか, *Plato in Twelve Volumes*, Loeb Classical Library, 1914–
- データ提供: [Perseus Digital Library](https://github.com/PerseusDL/canonical-greekLit)(Tufts University)

Perseus のデータは **CC BY-SA 4.0**。本リポジトリの**派生データおよび和訳もこれを継承する**。
コードのみ MIT(`LICENSE`)。
